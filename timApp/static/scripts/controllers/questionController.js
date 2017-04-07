/**
 * Controller for creating and editing questions
 * @module questionController
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */
var angular;
var timApp = angular.module('timApp');

function cleanParId(id) {
    var i = id.lastIndexOf(".");
    if ( i < 0 ) return id;
    return id.substring(i+1);
}

timApp.controller("QuestionController", ['$scope', '$http', '$window', '$element', 'ParCompiler', '$rootScope', function (scope, http, $window, $element, ParCompiler, $rootScope) {
    "use strict";

    // Timeout is used to make sure that #calendarStart element is rendered before creating datepicker
    $window.setTimeout(function () {
        angular.element('#calendarStart').datepicker({dateFormat: 'dd.m.yy'});
    }, 0);


    scope.dynamicAnswerSheetControl = {};
    scope.asked_id = false;

    scope.putBackQuotations = function (x) {
        var ox =  x.replace(/<br>/g, '\n');
        return ox.replace(/&quot;/g, '"');
    };

    scope.settings = $window.sessionsettings;

    scope.setTime = function () {
        scope.question.timeLimit = {hours: 0, minutes: 0, seconds: 30};
        if (scope.settings && scope.settings['timelimit'] && scope.settings['timelimit'] > 0) {
            var time = scope.settings['timelimit'];
            if (time > 3600) {
                scope.question.timeLimit.hours = Math.floor(time / 3600);
            } else {
                scope.question.timeLimit.hours = 0;
            }
            if (time > 60) {
                scope.question.timeLimit.minutes = Math.floor(time / 60);
                time = time % 60;
            } else {
                scope.question.timeLimit.minutes = 0;
            }
            if (time > 0) {
                scope.question.timeLimit.seconds = time;
            } else {
                scope.question.timeLimit.seconds = 0;
            }
        }
    };

    scope.$on("newQuestion", function (event, data) {
        scope.new_question = true;
        scope.par_id = "NEW_PAR";
        scope.markup = {};
        scope.par_id_next = data.par_id_next;
        scope.markup.qst = !!data.qst;
        scope.titleChanged = false;
        if ( scope.markup.qst ) {
            scope.question.endTimeSelected = false; // default no time
        }
        scope.addKeyListeners();
    });

    scope.$on("editQuestion", function (event, data) {
            var id = data.question_id;
            var par_id = data.par_id;
            var par_id_next = data.par_id_next;
            var asked_id = data.asked_id;
            var json = data.markup.json;
            scope.markup = data.markup;

            scope.asked_id = false;
            scope.new_question = false;
            scope.titleChanged = false;
            if (id) {
                scope.question.question_id = id;
            } else if (asked_id) {
                scope.asked_id = data.asked_id;
            } else {
                scope.par_id = par_id;
                scope.par_id_next = par_id_next;
            }

            if (json["questionTitle"]) scope.question.questionTitle = scope.putBackQuotations(json["questionTitle"]);
            if (scope.question.questionTitle == "Untitled") {
                scope.question.questionTitle = "";
                scope.titleChanged = true;
            }
            if (json["questionText"]) scope.question.question = scope.putBackQuotations(json["questionText"]);
            if (json["questionType"]) scope.question.type = json["questionType"];
            if (json["matrixType"]) scope.question.matrixType = json["matrixType"];
            if (json["answerFieldType"]) scope.question.answerFieldType = (json["answerFieldType"]);

            var jsonData = json.data || json;  // compability for old
            fixQuestionJson(jsonData);
            var jsonHeaders = jsonData.headers;
            var jsonRows = jsonData["rows"];

            var columnHeaders = [];
            if ( jsonHeaders )
            for (var i = 0; i < jsonHeaders.length; i++) {
                columnHeaders[i] = {
                    id: i,
                    type: jsonHeaders[i].type,
                    text: scope.putBackQuotations(jsonHeaders[i].text)
                };
            }
            scope.columnHeaders = columnHeaders;
            scope.pointsTable = getPointsTable(data.markup.points );

            var rows = [];

            for (var i = 0; i < jsonRows.length; i++) {
                var row = jsonRows[i];

                rows[i] = {
                    id: row.id,
                    text: scope.putBackQuotations(row.text),
                    type: row.type,
                    value: row.value  // TODO: mikä on value?
                };

                var idString = ""+(i+1); // rows[i].id.toString();
                if (data.markup.expl && idString in data.markup.expl) {
                    rows[i].expl = data.markup.expl[idString];
                }

                var jsonColumns = jsonRows[i]["columns"];
                if (!jsonColumns ) {
                    jsonColumns = [{}];
                    var nh = 0; if ( columnHeaders ) nh = columnHeaders.length;
                    for (var ic = 1; ic< nh; ic++) jsonColumns.push({});
                }

                var columns = [];
                for (var j = 0; j < jsonColumns.length; j++) {
                    var columnPoints = '';

                    if (scope.question.type === 'matrix' || scope.question.type === 'true-false') {
                        if (scope.question.matrixType !== 'textArea') {
                            if (scope.pointsTable.length > i) {
                                if ((j + 1).toString() in scope.pointsTable[i]) {
                                    columnPoints = scope.pointsTable[i][(j + 1).toString()];
                                }
                            }
                        }
                    } else {
                        if (scope.pointsTable.length > 0) {
                            if ((i + 1).toString() in scope.pointsTable[0]) {
                                columnPoints = scope.pointsTable[0][(i + 1).toString()];
                            }
                        }
                    }
                    columns[j] = {
                        id: j,
                        rowId: i,
                        text: jsonColumns[j].text,
                        points: columnPoints,
                        type: jsonColumns[j].type,
                        answerFieldType: jsonColumns[j].answerFieldType
                    };
                }
                rows[i].columns = columns;
            }
            scope.rows = rows;

            if (json["timeLimit"] && json["timeLimit"] > 0) {
                var time = json["timeLimit"];
                scope.question.endTimeSelected = true;
                if (time > 3600) {
                    scope.question.timeLimit.hours = Math.floor(time / 3600);
                    time = time % 3600;
                } else {
                    scope.question.timeLimit.hours = 0;
                }

                if (time > 60) {
                    scope.question.timeLimit.minutes = Math.floor(time / 60);
                    time = time % 60;
                } else {
                    scope.question.timeLimit.minutes = 0;
                }

                if (time > 0) {
                    scope.question.timeLimit.seconds = time;
                } else {
                    scope.question.timeLimit.seconds = 0;
                }

            } else {
                scope.question.endTimeSelected = false;
            }

            scope.$emit('toggleQuestion');
        

            scope.addKeyListeners();

            scope.textAreas = $(".questiontext");
            // ParCompiler.processAllMath($element.parent());
            window.setTimeout(function () { // give time to html to change
                ParCompiler.processAllMath($element.parent());
            }, 1000);

   /*
            scope.questionForm.addEventListener( "keydown", function(event) {
            // $("#question-form").keypress(function(event) {
                var c = String.fromCharCode(event.keyCode);
                if ( (event.which == 115 && event.ctrlKey) || (event.which == 19) ) { // ctrl-s
                    event.preventDefault();
                }
            });
            */
        }
    );


    scope.moveToElement = function(event, dir) {
        event.preventDefault();
        var activeObj = document.activeElement;
        var id = activeObj.id;
        if ( !id || id[0] !== "r" ) return 0;
        var edits = $("#question-form").find(".questiontext");
        var ind = parseInt(id.substr(1)) + dir;
        if ( ind < 0 ) return 0;
        if ( ind >= edits.length ) {
            scope.addRow(-1);
            edits[ind-2].focus();
            edits[ind-1].focus();
            $("#question-form").find("#r"+ind).focus();
            return 0;
        }
        edits[ind].focus();
        return 0;
    }


    scope.addKeyListeners = function() {
        if ( scope.questionForm ) return; // allready keys binded

        scope.questionForm = $("#question-form")[0];

        // var activeObj = document.activeElement;
        // activeObj.value = event.keyCode;

        scope.questionForm.addEventListener('keydown', function (event) {
            if (event.ctrlKey || event.metaKey) {
                switch (event.keyCode) {
                    case 37: // left
                        return;
                    case 38: // up
                        return scope.moveToElement(event, -1);
                    case 39: // right
                        return;
                    case 13: // down
                    case 40: // down
                        return scope.moveToElement(event, +1);
                }

                switch (String.fromCharCode(event.which).toLowerCase()) {
                    case 's':
                        event.preventDefault();
                        scope.createQuestion(false);
                        break;
                    case 'r':
                        event.preventDefault();
                        if (scope.lectureSettings.inLecture)
                            scope.createQuestion(true);
                        break;
                    case 'g':
                }
            }
        });
    }

    scope.question = {
        questionTitle: "",
        question: "",
        matrixType: "",
        answerFieldType: "",
        timeLimit: {hours: 0, minutes: 0, seconds: 30},
        endTimeSelected: true,
        showPreview: false
    };


    scope.rows = [];
    scope.columns = [];
    scope.columnHeaders = [];
    scope.setTime();
    scope.error_message = "";
    scope.answerFieldTypes = [
        {label: "Text area", value: "textArea"},
        {label: "Radio Button horizontal", value: "radiobutton-horizontal"},
        {label: "Checkbox", value: "checkbox"}
    ];



    /**
     * A function for creating a matrix.
     * @memberof module:questionController
     * @param type The answer type of the matrix.
     */
    scope.createMatrix = function (type) {

        if ( !scope.oldHeaders ) scope.oldHeaders = [];

        for (var i=0; i < scope.columnHeaders.length; i++) {
            if ( scope.columnHeaders[i].text ) scope.oldHeaders[i] = scope.columnHeaders[i].text;
        }


        var oldRows = scope.rows.count || 1;
        var oldCols = 1;
        if ( scope.rows.count ) oldCols = scope.rows[0].columns.length;

        var constHeaders = {};
        constHeaders["true-false"] = ["True", "False"];
        constHeaders["likert"] = ["1", "2", "3", "4", "5"];
        var rowsCount = 0;
        var columnsCount = 0;
        if (type === 'matrix' || type === 'true-false') {
            rowsCount = Math.max(2,oldRows);
            columnsCount = Math.max(2,oldCols);
        } else  if (type === 'textarea' ) {
            rowsCount = Math.max(1,oldRows);
            columnsCount = Math.max(1,oldCols);
        } else  if ( type === "likert") {
            rowsCount = Math.max(2,oldRows);
            columnsCount = Math.max(5,oldCols);
        } else {
            rowsCount = Math.max(4,oldRows);
            columnsCount = 1;
        }



        if (scope.rows.length < 1) {
            for (var i = 0; i < rowsCount; i++) {
                scope.addRow(i);
            }
        }


        if (type === 'radio-vertical' || type === 'true-false' || type === "likert") {
            scope.question.answerFieldType = 'radio';
        } else if (type === 'checkbox-vertical') {
            scope.question.answerFieldType = 'checkbox';
        } else if (type === 'matrix') {
            scope.question.answerFieldType = 'matrix';
        } else if (type === 'textarea') {
            scope.question.answerFieldType = 'text';
        }

        for (var i = 0; i < scope.rows.length; i++) {
            if (scope.rows[i].columns.length > columnsCount) scope.rows[i].columns.splice(columnsCount, scope.rows[i].columns.length);
            while (scope.rows[i].columns.length < columnsCount) scope.addCol(scope.rows[0].columns.length);
        }

        var t = type;
        if (type === 'textarea' ||  type === "likert") {
            type = "matrix";
        }

        scope.columnHeaders = [];
        if (type === 'matrix' || type === 'true-false') {
            for (var i = 0; i < scope.rows[0].columns.length; i++) {
                var text = '';
                var ch = constHeaders[t];
                if ( ch && i < ch.length  ) text = ch[i];
                if ( i < scope.oldHeaders.length && scope.oldHeaders[i] ) text = scope.oldHeaders[i];
                scope.columnHeaders[i] = {
                    id: i,
                    text: text,
                    type: 'header'
                };
            }
        }

        if ( t === 'likert' ) {
            scope.question.matrixType = 'radiobutton-horizontal';
        }

        if ( t == 'textarea') {
            scope.question.matrixType = 'textArea';
        }

        scope.question.type = type;

        // scope.columnHeaders = columnHeaders;
    };

    /**
     * A function to add a column to an existing matrix.
     * @memberof module:questionController
     * @param loc The index in the matrix where to add the new column.
     */
    scope.addCol = function (loc) {
        var location = loc;
        if (loc === -1) {
            location = scope.rows[0].columns.length;
            loc = scope.rows[0].columns.length;
        }
        scope.columnHeaders.splice(loc, 0, {type: "header", id: loc, text: ""});
        //add new column to columns
        for (var i = 0; i < scope.rows.length; i++) {
            scope.rows[i].columns.splice(loc, 0, {
                id: location,
                rowId: i,
                text: '',
                points: '',
                type: "answer",
                answerFiledType: scope.question.answerFieldType
            });
        }
        if (scope.question.showPreview) scope.createJson();
    };

    /**
     * The function adds a row to an existing matrix
     * @memberof module:questionController
     * @param loc The index in the matrix where to add the new row.
     */
    scope.addRow = function (loc) {
        scope.CreateColumnsForRow = function (location) {
            var columns = [];
            if (scope.rows.length > 0) {
                for (var j = 0; j < scope.rows[0].columns.length; j++) {
                    columns[j] = {
                        id: j,
                        rowId: location,
                        type: "answer",
                        value: '',
                        answerFiledType: scope.question.answerFieldType,
                        points: ""
                    };

                }
            }
            return columns;
        };

        var location = loc;
        if (loc === -1) {
            location = scope.rows.length;
            loc = scope.rows.length;
        }

        var columns = scope.CreateColumnsForRow(location);
        scope.rows.splice(loc, 0,
            {
                id: location,
                text: "",
                type: "question",
                value: "",
                columns: columns
            });

        for (var i = 0; i < scope.rows.length; i++) {
            scope.rows[i].id = i+1;
        }

        if (scope.question.showPreview) scope.createJson();
    };

    /**
     * A function to delete a row from a matrix.
     * @memberof module:questionController
     * @param indexToBeDeleted The index of the row to be deleted.
     */
    scope.delRow = function (indexToBeDeleted) {
        scope.error_message = "";
        if (scope.rows.length > 1) {
            if (indexToBeDeleted === -1) {
                scope.rows.splice(-1, 1);
            }
            else {
                scope.rows.splice(indexToBeDeleted, 1);
            }
        } else {
            scope.errorize("", "You cannot have an empty table.");
        }

        for (var i = 0; i < scope.rows.length; i++) {
            scope.rows[i].id = i+1;
        }

        if (scope.question.showPreview) scope.createJson();
    };

    /**
     * A function to delete a column from a matrix.
     * @memberof module:questionController
     * @param indexToBeDeleted Index of the column to be deleted.
     */
    scope.delCol = function (indexToBeDeleted) {
        for (var i = 0; i < scope.rows.length; i++) {
            if (indexToBeDeleted === -1) {
                scope.rows[i].columns.splice(-1, 1);
            }
            else {
                scope.rows[i].columns.splice(indexToBeDeleted, 1);
            }
        }
        if (indexToBeDeleted === -1) {
            scope.columnHeaders.splice(-1, 1);
        }
        else {
            scope.columnHeaders.splice(indexToBeDeleted, 1);
        }

        if (scope.question.showPreview) scope.createJson();
    };

    /**
     * A function to reset the question values.
     * @memberof module:questionController
     */
    scope.clearQuestion = function () {
        scope.question = {
            questionTitle: "",
            question: "",
            matrixType: "",
            answerFieldType: "",
            endTimeSelected: true,
            showPreview: false
        };
        scope.setTime();

        scope.rows = [];
        scope.answer = "";
        scope.columnHeaders = [];
    };

    /**
     * A function to close question edition form.
     * @memberof module:questionController
     */
    scope.close = function () {
        scope.removeErrors();
        scope.clearQuestion();
        scope.setShowPreview(false);
        scope.dynamicAnswerSheetControl.closePreview();
        if (scope.questionShown) scope.$emit('toggleQuestion');
        if (scope.new_question) scope.handleCancel({docId: scope.docId, par: "NEW_PAR"});
    };

    /**
     * The function replaces linebreaks with HTML code.
     * @memberof module:questionController
     * @param val The input string
     * @returns {*} The reformatted line.
     */
    scope.replaceLinebreaksWithHTML = function (val) {
        var output = val.replace(/(?:\r\n|\r|\n)/g, '<br>');
        // output = output.replace(/"/g, '&quot;');
        //return output.replace(/\\/g, "\\\\");
        // var output = val.replace(/(?:\r\n)/g, '\n');
        return output;
    };

    /**
     * The function to highlight the source of the errors for a given ID.
     * @memberof module:questionController
     * @param div_val ID of the element to be errorized.
     * @param error_text Description of the occured error.
     */
    scope.errorize = function (div_val, error_text) {
        angular.element("#" + div_val).css('border', "1px solid red");
        if (error_text.length > 0) {
            scope.error_message += error_text + "<br />";
        }
    };

    /**
     * The function to highlight the source of the errors for a given class.
     * @memberof module:questionController
     * @param div_val Class of the element to be errorized.
     * @param error_text Description of the occured error.
     */
    scope.errorizeClass = function (div_val, error_text) {
        angular.element("." + div_val).css('border', "1px solid red");
        if (error_text.length > 0) {
            scope.error_message += error_text + "<br />";
        }
    };

    /**
     * Removes border of a given element.
     * @memberof module:questionController
     * @param element ID of the field whose border will be removed.
     */
    scope.defInputStyle = function (element) {
        if (element !== null || !element.isDefined) {
            angular.element("#" + element).css("border", "");
        }
    };

    /**
     * Calls defInputStyle for all the form elements.
     * @memberof module:questionController
     */
    scope.removeErrors = function () {
        scope.error_message = "";
        var elementsToRemoveErrorsFrom = [
            "questionName",
            "questionTiming",
            "questionStart",
            "questionTimer",
            "qType",
            "matrix",
            "durationSec",
            "durationHour",
            "durationMin",
            "durationDiv"
        ];
        for (var i = 0; i < elementsToRemoveErrorsFrom.length; i++) {
            if (elementsToRemoveErrorsFrom[i] !== undefined) {
                scope.defInputStyle(elementsToRemoveErrorsFrom[i]);
            }
        }
        angular.element(".rowHeading").css("border", "");
    };

    /**
     * Function for checking if the row headings are empty.
     * @memberof module:questionController
     * @param rows The array of rows to be checked.
     * @returns {boolean} Whether or not the row headings are empty.
     */
    scope.rowHeadingsEmpty = function (rows) {
        if ( rows.length < 2 ) return false;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].text === "" || rows[i].text === null) {
                return true;
            }
        }
        return false;
    };

    /**
     * Checks if a value is a positive number and makes the appropriate errors if this is not the case.
     * @memberof module:questionController
     * @param element The value to be checked.
     * @param val The id of the value, which is used in case the number is not positive.
     */
    scope.isPositiveNumber = function (element, val) {
        if (element === "" || isNaN(element) || element < 0) {
            scope.errorize(val, "Number has to be positive.");
        }
    };


    /**
     * Creates a string of points. Rows are separated by | and answers in the same row separated by ;
     * @returns {string}
     */
    scope.createPoints = function () {
        var points = '';
        var separator = '';
        var separator2 = '';
        var n = 0;
        if (scope.question.type === 'matrix' || scope.question.type === 'true-false') {
            if (scope.question.matrixType !== 'textArea') {
                for (var i = 0; i < scope.rows.length; i++) {
                    points += separator;
                    separator2 = '';
                    for (var j = 0; j < scope.rows[i].columns.length; j++) {
                        var currentColumn = scope.rows[i].columns[j];
                        if (currentColumn.points !== '' && currentColumn.points != '0') {
                            points += separator2;
                            var id = parseInt(currentColumn.id) + 1;
                            points += id.toString() + ':' + parseFloat(currentColumn.points) || 0;
                            separator2 = ';';
                            n++;
                        }
                    }
                    separator = '|';
                }
            }
        } else {
            for (var i = 0; i < scope.rows.length; i++) {
                points += separator;
                var currentColumn = scope.rows[i].columns[0];
                if (currentColumn.points !== '' && currentColumn.points != '0') {
                    points += separator2;
                    var id = parseInt(scope.rows[i].id);
                    points += id.toString() + ':' + parseFloat(currentColumn.points) || 0;
                    separator2 = ';';
                    n++;
                }
            }
        }
        if ( n ) return points;
        return null;
    };

    /**
     * Creates a dict with explanations for question rows
     * @returns {{}}
     */
    scope.createExplanation = function () {
        var expl = {};
        var n = 0;
        for (var i = 0; i < scope.rows.length; i++) {
            var row = scope.rows[i];
            if (row.expl && row.expl.trim()) {
                expl[row.id] = row.expl.trim();
                n++;
            }
        }
        if ( n ) return expl;
        return null;
    };

    /**
     * Creates question json
     * @returns {{questionText: string, title: string, questionType: *, answerFieldType: string, matrixType: string,
     * timeLimit: string, data: {headers: Array, rows: Array}}}
     */
    scope.createJson = function () {
        if (scope.asked_id) {
            return scope.updatePoints();
        }
        scope.removeErrors();
        scope.question.questionTitle = $('#qTitle').val();
        if(scope.question.questionTitle == "") {
            scope.question.questionTitle = "Untitled";
        }
        if (scope.question.question === undefined || scope.question.question.trim().length === 0 || scope.question.questionTitle === undefined || scope.question.questionTitle.trim().length === 0) {
            scope.errorize("questionName", "Question is required.");
        }
        if (scope.question.type === undefined) {
            scope.errorize("qType", "Question type must be selected.");
        } else if (scope.question.type === "matrix" && (scope.question.matrixType === undefined || scope.question.matrixType === "")) {
            scope.errorize("check", "Answer type must be selected.");
        } else if ( /*(scope.question.type === "radio-vertical" ||
            scope.question.type === "checkbox-vertical" ||
            scope.question.type === "true-false") && */
            scope.rowHeadingsEmpty(scope.rows)) {
            scope.errorizeClass("rowHeading", "All rows must be filled in.");
        }
        if (scope.rows.length > 0) {
            if ((scope.question.type === "radio-vertical" /*|| scope.question.type === "checkbox-vertical"*/) && scope.rows.length < 2) {
                scope.errorize("matrix", "You must have at least two choices.");
            }
        } else if (scope.question.type !== undefined) {
            scope.errorize("matrix", "You must have at least one row.");
        }
        var timeLimit = "";
        if (scope.question.endTimeSelected) {
            if (scope.question.timeLimit.hours === "") {
                scope.question.timeLimit.hours = 0;
            }
            if (scope.question.timeLimit.minutes === "") {
                scope.question.timeLimit.minutes = 0;
            }
            if (scope.question.timeLimit.seconds === "") {
                scope.question.timeLimit.seconds = 0;
            }
            scope.isPositiveNumber(scope.question.timeLimit.hours, "durationHour");
            scope.isPositiveNumber(scope.question.timeLimit.minutes, "durationMin");
            scope.isPositiveNumber(scope.question.timeLimit.seconds, "durationSec");
            timeLimit = 0;
            timeLimit = parseInt(timeLimit) + parseInt(scope.question.timeLimit.seconds);
            if (scope.question.timeLimit.hours) {
                timeLimit = parseInt(timeLimit) + (scope.question.timeLimit.hours * 60 * 60);
            }
            if (scope.question.timeLimit.minutes) {
                timeLimit = parseInt(timeLimit) + (scope.question.timeLimit.minutes * 60);
            }
            if (timeLimit <= 0) {
                scope.errorize("durationDiv", "Please enter a duration greater then zero or for unending question uncheck the duration box.");
            }
        } else {
            timeLimit = "";
        }

        if (scope.error_message !== "") {
            if (scope.question.questionTitle == "Untitled") {
                scope.question.questionTitle = "";
            }
            return;
        }
        scope.removeErrors();
        if (scope.question.type === 'matrix') {

            if (scope.question.matrixType === "radiobutton-horizontal" || scope.question.matrixType === "radiobutton-vertical") {
                scope.question.answerFieldType = "radio";
            }

            if (scope.question.matrixType === "textArea") {
                scope.question.answerFieldType = "text";
            }
            if (scope.question.matrixType === "checkbox") {
                scope.question.answerFieldType = "checkbox";
            }
        }

        scope.question.question = scope.replaceLinebreaksWithHTML(scope.question.question);
        scope.question.questionTitle = scope.replaceLinebreaksWithHTML(scope.question.questionTitle);

        var headersJson = [];
        if (scope.question.type === "matrix" || scope.question.type === "true-false" || scope.question.type == "" ) {
            for (i = 0; i < scope.columnHeaders.length; i++) {
                var header = {
                    'type': scope.columnHeaders[i].type,
                    'id': scope.columnHeaders[i].id,
                    'text': scope.replaceLinebreaksWithHTML(scope.columnHeaders[i].text) || ''
                };
                headersJson.push(header);
            }
        }


        var rowsJson = [];
        for (var i = 0; i < scope.rows.length; i++) {
            var text = scope.replaceLinebreaksWithHTML(scope.rows[i].text);
            var row = {
                'id': scope.rows[i].id,
                'type': scope.rows[i].type,
                'text': scope.replaceLinebreaksWithHTML(scope.rows[i].text)
            };
            var columnsJson = [];
            for (var j = 0; j < scope.rows[i].columns.length; j++) {
                var column = {
                    'id': scope.rows[i].columns[j].id,
                    'type': scope.rows[i].columns[j].type,
                    'rowId': row.id
                };
                columnsJson.push(column);
            }
            row['columns'] = columnsJson;
            rowsJson.push(row);
        }

        var questionjson = {
            'questionText': scope.question.question,
            'questionTitle': scope.question.questionTitle,
            'questionType': scope.question.type,
            'answerFieldType': scope.question.answerFieldType,
            'matrixType': scope.question.matrixType,
            'timeLimit': timeLimit,
            'headers': headersJson,
            'rows': rowsJson
        };

        scope.markup.json = questionjson;
        scope.dynamicAnswerSheetControl.createAnswer(scope);
        return minimizeJson(questionjson);
    };

    /**
     * Validates and saves the question into the database.
     * @memberof module:questionController
     */
    scope.createQuestion = function (ask) {
        var questionjson = scope.createJson();
        if (!questionjson) return;
        var doc_id = scope.docId;

        var md = scope.markup;
        var points = scope.createPoints();
        if ( points ) md.points = points; else delete md.points;
        var expl = scope.createExplanation();
        if ( expl ) md.expl = expl; else delete md.expl;
        md.json = questionjson;
        md = JSON.stringify(md, null, 4);

        // var yaml = JSON2YAML(questionjson);
        // console.log(yaml);

        // Without timeout 'timelimit' won't be saved in settings session variable. Thread issue?
        scope.settings['timelimit'] = questionjson.timeLimit || "";
        setTimeout(function () {
            var v = questionjson.timeLimit || "";
            if ( !v ) v = 0;
            setsetting('timelimit', ""+v );
        }, 1000);
        
        var route = '/postParagraphQ/';
        if (scope.new_question) {
            route = '/newParagraphQ/';
        }
        http.post(route, angular.extend({
            docId: doc_id,
            text: md,
            par: cleanParId(scope.par_id),
            par_next: scope.par_id_next
        })).success(function (data) {
            $window.console.log("The question was successfully added to database");
            scope.removeErrors();
            scope.addSavedParToDom(data, {docId: scope.docId, par: scope.par_id, par_next: scope.par_id_next});
            //TODO: This can be optimized to get only the new one.
            // scope.$parent.getQuestions(); // TODO hae tallennettu kysymys!
            if (ask) {

                http({
                    url: '/getQuestionByParId',
                    method: 'GET',
                    params: {'par_id': scope.par_id, 'doc_id': scope.docId}
                })
                    .success(function (data) {
                        scope.markup = data.markup;
                        $rootScope.$broadcast('changeQuestionTitle', {'questionTitle': scope.markup.json.questionTitle});
                        $rootScope.$broadcast("setPreviewJson", {
                            markup: scope.markup,
                            questionParId: scope.questionParId,
                            questionParIdNext: scope.questionParIdNext,
                            isLecturer: scope.isLecturer
                        });
                        var pid = scope.par_id;
                        // if ( data.new_par_ids.length > 0 ) pid = data.new_par_ids[0];
                        scope.json = questionjson;
                        scope.$emit('askQuestion', {
                            "lecture_id": scope.lectureId,
                            "question_id": scope.qId,
                            "doc_id": scope.docId,
                            "par_id": pid,
                            "markup": scope.markup
                        });
                    })

                    .error(function () {
                        $log.error("Could not get question.");
                    });

/*
                var pid = scope.par_id;
                if ( data.new_par_ids.length > 0 ) pid = data.new_par_ids[0];
                scope.json = questionjson;
                scope.$emit('askQuestion', {
                    "lecture_id": scope.lectureId,
                    "question_id": scope.qId,
                    "doc_id": scope.docId,
                    "par_id": pid,
                    "markup": scope.markup
                });
*/
            }
            scope.close();
        }).error(function () {
            scope.showDialog("Could not create question");
            $window.console.log("There was some error creating question to database.");
        });
/*
        http({
            method: 'POST',
            url: '/addQuestion/',
            params: {
                'question_id': scope.question.question_id,
                'question_title': scope.question.title,
                'answer': "test", //answerVal,
                'par_id': par_id,
                'doc_id': doc_id,
                'points': points,
                'expl': JSON.stringify(expl),
                'questionjson': JSON.stringify(questionjson)
            }
        })
            .success(function (data) {
                $window.console.log("The question was successfully added to database");
                scope.removeErrors();
                //TODO: This can be optimized to get only the new one.
                scope.$parent.getQuestions();
                if (ask) {
                    scope.json = JSON.parse(data.questionjson);
                    scope.qId = data.question_id;
                    scope.$emit('askQuestion', {
                        "lecture_id": scope.lectureId,
                        "question_id": scope.qId,
                        "doc_id": scope.docId,
                        "json": scope.json
                    });
                }
            }).error(function () {
                $window.console.log("There was some error creating question to database.");
            });
        scope.close();
*/
    };

    /**
     * Calls /updatePoints/ to update questions points according to form
     */
    scope.updatePoints = function () {
        var points = scope.createPoints();
        var expl = scope.createExplanation();
        http({
            method: 'POST',
            url: '/updatePoints/',
            params: {
                'asked_id': scope.asked_id,
                'points': points,
                'expl': expl

            }
        })
            .success(function () {
                $window.console.log("Points successfully updated.");
            }).error(function () {
            $window.console.log("There was some error when updating points.");
        });
        scope.close();
    };

    scope.deleteQuestion = function () {
        var confirmDi = $window.confirm("Are you sure you want to delete this question?");
        if (confirmDi) {
            http.post('/deleteParagraph/' + scope.docId, {par: scope.par_id})
                .success(function (data) {
                    $window.console.log("Deleted question done!");
                    scope.handleDelete(data, {par: scope.par_id, area_start: null, area_end: null});
                    scope.close();
                    scope.getQuestions();
                })
                .error(function (error) {
                    $window.console.log(error);
                    scope.getQuestions();
                });
        }
    };

    scope.explFocus = function ($event) {
        $($event.target).parent().addClass('explFocus');
    };

    scope.explBlur = function ($event) {
        $($event.target).parent().removeClass('explFocus');
    };

    /**
     * Creates question json to be displayed in preview.
     * @param show if true add event handler to input change, if false remove eventhandlers
     */
    scope.setShowPreview = function (show) {
        if (show) {
            scope.createJson();
            $(".createQuestion").on('change.createjson', ':input', function () {
                scope.createJson();
            });
        } else {
            $(".createQuestion").off('change.createjson');
        }
    };

    /**
     * Changes the question title field to match the question if user hasn't defined title
     * @param question of question
     */
    scope.changeQuestionTitle = function (question) {
        if(!scope.question.questionTitle && !scope.titleChanged) {
            $('#qTitle').val(question);
        }
    };

    scope.titleIsChanged = function () {
        scope.titleChanged = true;
    };


    scope.checkKeydown = function(e) {
        var c = String.fromCharCode(event.keyCode);
    }

}])
;
