import angular, {IController, IOnChangesObject, IRootElementService} from "angular";
import $ from "jquery";
import {timApp} from "tim/app";
import {ParCompiler} from "../services/parCompiler";
import {
    IAskedJsonJson,
    IAskedJsonJsonJson,
    IExplCollection,
    IHeader,
    IProcessedHeaders,
    IUnprocessedHeaders,
    IUnprocessedHeadersCompat,
} from "../lecturetypes";

/**
 * Created by localadmin on 25.5.2015.
 * Directive for dynamic answer sheet. Sheet to answer lecture questions.
 * If preview parameter is used, inputs are disable and there is no progressbar or answer button
 * @module dynamicAnswerSheet
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @author Vesa Lappalainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

function uncheckRadio(this: HTMLElement) {
    // set this to click-method if you want a radio that can be uncheked.  for the radio there
    // must be also property form that has other radios.
    const elem = $(this);
    const form = elem.prop("form");
    if (!form) {
        return;
    }
    const gn = elem.prop("name");
    if (elem.prop("previousValue") === true) {
        elem.prop("checked", false);
    } else {
        $("input[name=" + gn + "]", form).prop("previousValue", false);
        // elem.prop('previousValue', false);
    }
    elem.prop("previousValue", elem.prop("checked"));
}

export function getJsonAnswers(answer: string): string[][] {
    // Converts answer string to JSON table
    if (answer.length > 0 && answer[0] === "[") {
        return JSON.parse(answer);
    }
    const singleAnswers: string[][] = [];
    const allAnswers = answer.split("|");

    for (const a of allAnswers) {
        singleAnswers.push(a.split(","));
    }
    return singleAnswers;
}

function deletePar(s: string) {
    if (!s.startsWith("<p>")) {
        return s;
    }
    const rs = s.substring(3);
    if (!rs.endsWith("</p>")) {
        return s;
    }
    return rs.substring(0, rs.length - 4);
}

export function getPointsTable(markupPoints: string): Array<{[points: string]: string}> {
    // Format of markupPoints: 1:1.1;2:1.2;3:1.3||2:3.2
    const pointsTable: Array<{[points: string]: string}> = [];
    if (markupPoints && markupPoints !== "") {
        const points = markupPoints.split("|");
        for (let i = 0; i < points.length; i++) {
            const rowPoints = points[i].split(";");
            const rowPointsDict: {[points: string]: string} = {};
            for (let k = 0; k < rowPoints.length; k++) {
                if (rowPoints[k] !== "") {
                    const colPoints = rowPoints[k].split(":", 2);
                    rowPointsDict[colPoints[0]] = colPoints[1];
                }
            }
            pointsTable.push(rowPointsDict);
        }
    }
    return pointsTable;
}

export function minimizeJson(json: IProcessedHeaders): IUnprocessedHeaders {
    // remove not needed fields from json, call when saving the question
    const result: IUnprocessedHeaders = {
        answerFieldType: null,
        headers: null,
        questionType: null,
        rows: null,
    };
    if (json.headers) {
        result.headers = [];
        for (let i = 0; i < json.headers.length; i++) {
            let header = json.headers[i];
            if (header.id == i && header.type === "header") {
                header = header.text;
            }
            result.headers.push(header);
        }
    }

    let allText = true;
    const rows = json.rows;
    const rrows = [];

    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        if (row.id == i + 1 && (!row.type || row.type === "question")) {
            row = row.text; // { text: row.text};
        } else {
            allText = false;
        }
        rrows.push(row);
    }
    // rrows.push({}); // push empty object to force Python json yaml dump to put rows in separate lines. Remember to remove it

    // if ( allText ) rrows = rrows.join("\n"); // oletuksena menee samalle riville kaikki json text muunnoksessa.

    result.rows = rrows;
    result.answerFieldType = json.answerFieldType;
    result.questionType = json.questionType;
    return result;
}

function fixLineBreaks(s: string) {
    // var result = s.replace(" < "," &lt; ");
    //result = result.replace(" > "," &gt; ");
    const parts = s.split("!!");
    const result = parts[0];
    return result;
    //return s.replace("\n","<br />");
}

export function fixQuestionJson(json: IUnprocessedHeadersCompat): IProcessedHeaders {
    // fill all missing fields from question json, call before use json
    // row ids are by default 1-based and header ids 0-based
    const fixed: IProcessedHeaders = {headers: [], rows: [], answerFieldType: "radio", questionType: json.questionType};
    const headers = json.data ? json.data.headers : json.headers;
    const rows = json.data ? json.data.rows : json.rows;
    if (headers) {
        if (typeof headers === "string") { // if just on text string
            const jrows = headers.split("\n");
            const newHeaders: IHeader[] = [];
            let ir = -1;
            for (const jrow of jrows) {
                if (jrow) {
                    ir++;
                    newHeaders.push({text: jrow.toString(), type: "header", id: ir});
                }
            }
            fixed.headers = newHeaders;
        } else {
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                fixed.headers.push({text: header.toString(), type: "header", id: i});
            }
        }
    }

    if (json.answerFieldType) {
        fixed.answerFieldType = json.answerFieldType;
    }

    if (json.questionType === "true-false" && (!json.headers || json.headers.length === 0)) {
        fixed.headers = [
            {type: "header", id: 0, text: "True"},
            {type: "header", id: 1, text: "False"},
        ];
    }

    const blankColumn = {text: "", type: "question", answerFieldType: ""}; // TODO: needs id?
    if (typeof rows === "string") { // if just on text string
        const jrows = rows.split("\n");
        for (let i = 0; i < jrows.length; i++) {
            const jrow = jrows[i];
            if (jrow) {
                fixed.rows.push({
                    columns: [blankColumn],
                    id: i + 1,
                    text: jrow.toString(),
                    type: "question",
                });
            }
        }
    } else {
        let ir = -1;
        for (const r of rows) {
            ir++;
            fixed.rows.push({
                columns: [blankColumn],
                id: ir + 1,
                text: r,
                type: "question",
            });
        }
    }

    for (const row of fixed.rows) {
        let nh = 0;
        if (fixed.headers) {
            nh = fixed.headers.length;
        }
        for (let ic = 1; ic < nh; ic++) {
            row.columns.push(blankColumn);
        }
    }
    return fixed;
}

export interface IPreviewParams {
    points: string;
    answerTable: string[][];
    noDisable: boolean;
    preview: boolean;
    result: {};
    previousAnswer: string;
    answclass: string;
    expl: IExplCollection;
    markup: IAskedJsonJson;
}

class AnswerSheetController implements IController {
    private static $inject = ["$element"];
    private element: IRootElementService;
    private preview: boolean;
    private result: {};
    private json: IAskedJsonJsonJson;
    private processed: IProcessedHeaders;
    private markup: IAskedJsonJson;
    private answerTable: string[][];
    private expl: IExplCollection;
    private htmlSheet: JQuery;

    constructor(element: IRootElementService) {
        this.element = element;
    }

    $onInit() {

    }

    cg() {
        return "group";
    }

    $onChanges(onChangesObj: IOnChangesObject) {
        const data = onChangesObj.questiondata.currentValue as IPreviewParams;
        if (data === null) {
            return;
        }
        this.createAnswer(data);
    }

    /**
     * Creates question answer/preview form.
     */
    createAnswer(params: IPreviewParams) {
        this.result = params.result;

        const answclass = params.answclass || "answerSheet";

        let disabled = "";
        // If showing preview or question result, inputs are disabled
        if (params.preview || this.preview || this.result) {
            disabled = " disabled ";
        }
        if (params.noDisable) {
            disabled = "";
        }

        this.element.empty();
        this.json = params.markup.json;
        this.markup = params.markup;
        const unprocessed = this.json.data || this.json; // compability to old format
        const json = this.json;

        const data = fixQuestionJson(unprocessed);
        this.processed = data;

        this.answerTable = params.answerTable || [];

        // If user has answer to question, create table of answers and select inputs according to it
        if (params.previousAnswer) {
            this.answerTable = getJsonAnswers(params.previousAnswer);
        }
        const answerTable = this.answerTable;
        const pointsTable = getPointsTable(params.points || params.markup.points);

        this.expl = params.expl || params.markup.expl;
        // var htmlSheet = $('<div>', {class: answclass});
        const htmlSheet = $("<form>", {class: answclass});
        this.htmlSheet = htmlSheet;

        const h5 = $("<h5>");
        h5.append(fixLineBreaks(json.questionText));

        htmlSheet.append(h5);
        // htmlSheet.append($('<h5>', {text: json.questionText}));
        if (params.markup.userpoints !== undefined) {
            htmlSheet.append($("<p>", {text: "Points: " + params.markup.userpoints}));
        }

        const table = $("<table>", {id: "answer-sheet-table", class: "table table-borderless"});

        let totalBorderless = true;

        if (data.headers &&
            data.headers.length > 0 && !(data.headers[0].text === "" && data.headers.length === 1)) {
            const tr = $("<tr>", {class: "answer-heading-row"});
            if (data.headers.length > 0) {
                tr.append($("<th>"));
            }
            for (const header of data.headers) {
                const th = $("<th>");
                th.append(fixLineBreaks(header.text));
                totalBorderless = false;
                tr.append(th);
                // tr.append($('<th>', {text: header.text || header}));
            }
            if (this.result && this.expl) {
                tr.append($("<th>", {}));
            }
            table.append(tr);
        }

        let ir = -1;
        for (const row of data.rows) {
            ir++;
            let pointsRow = {};
            if (params.result && pointsTable.length > ir && pointsTable[ir]) {
                pointsRow = pointsTable[ir];
            }
            const rtext = fixLineBreaks(row.text);
            const tr = $("<tr>");
            if (json.questionType === "matrix" || json.questionType === "true-false") {
                const td = $("<td>");
                td.append(rtext);
                if (rtext && ir > 0) {
                    totalBorderless = false;
                }
                tr.append(td);
                //tr.append($('<td>', {text: row.text}));
            }
            let header = 0;
            //TODO: Needs correct JSON to be made better way
            for (let ic = 0; ic < row.columns.length; ic++) {
                let group;
                group = this.cg() + ir;

                if (json.questionType === "matrix" || json.questionType === "true-false") {
                    const value = "" + (ic + 1); // (row.columns[ic].id + 1).toString();

                    let colTDPoints;
                    let colPtsClass = "qst-normal";
                    if (value in pointsRow) {
                        const colPoints = pointsRow[value];
                        colTDPoints = $("<p>", {class: "qst-points"}).append(colPoints);
                        if (colPoints > 0) {
                            colPtsClass = "qst-correct";
                        }
                    }
                    row.columns[ic].id = ic;

                    if (json.answerFieldType === "text") {
                        let text = "";
                        if (answerTable && ir < answerTable.length && ic < answerTable[ir].length) {
                            text = answerTable[ir][ic];
                        }
                        const textArea = $("<textarea>", {
                            id: "textarea-answer",
                            name: group,
                        });
                        textArea.text(text);
                        if (disabled !== "") {
                            textArea.attr("disabled", "disabled");
                        }
                        if (data.headers && data.headers.length === 1 && data.headers[0].text === "" && data.rows.length === 1) {
                            // textArea.attr('style', 'height:200px');
                        }
                        tr.append($("<td>", {class: "answer-button"}).append($("<label>").append(textArea)));
                        header++;
                    } else {
                        // group = this.cg() + rtext.replace(/[^a-zA-Z0-9]/g, "");
                        let checked = false;
                        if (answerTable && ir < answerTable.length) {
                            checked = (answerTable[ir].indexOf(value) >= 0);
                        }
                        const input: JQuery = $("<input>", {
                            type: json.answerFieldType,
                            name: group,
                            value: ic + 1, // parseInt(row.columns[ic].id) + 1,
                            checked,
                        });
                        if (json.answerFieldType === "radio") {
                            input.click(uncheckRadio);  // TODO: Tähän muutoskäsittely ja jokaiseen tyyppiin tämä
                        }
                        if (disabled !== "") {
                            input.attr("disabled", "disabled");
                        }

                        const td = $("<td>", {class: "answer-button"});
                        const ispan = $("<span>", {class: colPtsClass});
                        ispan.append(input);
                        td.append($("<label>").append(ispan));

                        if (colTDPoints) {
                            td.append(colTDPoints);
                        }
                        tr.append(td);
                        header++;
                    }
                } else {
                    const value = "" + (ir + 1); // (row.id + 1).toString();
                    let colTDPoints;
                    let colPtsClass = "qst-normal";
                    let pointsRow = {};
                    if (params.result && pointsTable.length > 0 && pointsTable[0]) pointsRow = pointsTable[0];
                    if (value in pointsRow) {
                        const colPoints = pointsRow[value];
                        colTDPoints = $("<p>", {class: "qst-points"}).append(colPoints);
                        if (colPoints > 0) {
                            colPtsClass = "qst-correct";
                        }
                    }
                    row.columns[ic].id = ic;

                    const type = row.type || "question";
                    group = this.cg() + type.replace(/[^a-zA-Z0-9]/g, "");
                    let checked = false;
                    if (answerTable && answerTable.length > 0) {
                        checked = (answerTable[0].indexOf(value) >= 0);
                    }
                    const input = $("<input>", {
                        type: json.answerFieldType,
                        name: group,
                        value: ir + 1, //parseInt(row.id) + 1,
                        checked,
                    });
                    if (json.answerFieldType === "radio") {
                        input.click(uncheckRadio);
                    }
                    if (disabled !== "") {
                        input.attr("disabled", "disabled");
                    }
                    const label = $("<label>");
                    const ispan = $("<span>", {class: colPtsClass});
                    ispan.append(input);
                    label.append(ispan).append(" " + deletePar("" + rtext));
                    const td = $("<td>", {class: "answer-button2"});
                    td.append(label);
                    if (colTDPoints) {
                        td.append(colTDPoints);
                    }
                    tr.append(td);
                }
            }
            // If showing question results, add question rows explanation
            if (this.result && this.expl) {
                let expl = "";
                const ir1 = (ir + 1).toString();
                if (ir1 in this.expl) {
                    expl = this.expl[ir1];
                }
                const tde = $("<td>", {class: "explanation"});
                tde.append(expl);
                // tr.append($('<td>', {class: 'explanation', text: expl}));
                tr.append(tde);
            }
            table.append(tr);
        }

        htmlSheet.append($("<div>").append(table));

        if (totalBorderless) {
            table.addClass("total-borderless");
        }

        this.element.append(htmlSheet);
        ParCompiler.processAllMathDelayed(this.htmlSheet);
    }

    getAnswers() {
        const answers = [];
        const data = this.processed;
        if (angular.isDefined(data.rows)) {
            let groupName; // data.rows[ir].text.replace(/[^a-zA-Z0-9]/g, '');
            if (this.json.questionType === "matrix" || this.json.questionType === "true-false") {
                for (let ir = 0; ir < data.rows.length; ir++) {
                    groupName = this.cg() + ir;
                    const answer = [];
                    let matrixInputs;
                    // groupName = this.cg() + ir; // data.rows[ir].text.replace(/[^a-zA-Z0-9]/g, '');

                    if (this.json.answerFieldType === "text") {
                        matrixInputs = $(`textarea[name=${groupName}]`, this.htmlSheet);
                        for (let ic = 0; ic < matrixInputs.length; ic++) {
                            const v = matrixInputs[ic].value || "";
                            answer.push(v);
                        }

                        answers.push(answer);
                        continue;
                    }

                    matrixInputs = $(`input[name=${groupName}]:checked`, this.htmlSheet);

                    for (let k = 0; k < matrixInputs.length; k++) {
                        const v = matrixInputs[k].value || "";
                        answer.push(v);
                    }
                    if (matrixInputs.length <= 0) {
                        answer.push("");
                    }
                    answers.push(answer);
                }
            } else {
                answers.push([]);
                const type = data.rows[0].type || "question";
                groupName = this.cg() + type.replace(/[^a-zA-Z0-9]/g, "");
                const checkedInputs = $("input[name=" + groupName + "]:checked", this.htmlSheet) as any as HTMLInputElement[];
                for (let j = 0; j < checkedInputs.length; j++) {
                    answers[0].push(checkedInputs[j].value);
                }

                if (checkedInputs.length <= 0) {
                    answers[0].push(""); // was "undefined"
                }
            }
        }

        // TODO: most likely dead code
        // if (angular.isDefined(data.columns)) {
        //     for (const column of data.columns) {
        //         const groupName = this.cg() + column.Value.replace(/ /g, "");
        //         answers.push($("input[name=" + groupName + "]:checked").val());
        //     }
        // }
        return answers;
    }
}

timApp.component("dynamicAnswerSheet", {
    bindings: {
        preview: "<",
        questiondata: "<",
    },
    controller: AnswerSheetController,
    template: `<div class="answer-sheet-root">

</div>`,
});
