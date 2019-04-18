import {IRootElementService, IScope} from "angular";
import $ from "jquery";
import {timApp} from "tim/app";
import {DialogController, registerDialogComponent, showDialog} from "../../ui/dialog";

timApp.directive("noPeriod", () => (scope, element, attrs) => {
    const keyCode = [190, 188, 110];
    element.bind("keydown", (event) => {
        if ($.inArray(event.which, keyCode) !== -1) {
            scope.$apply(() => {
                scope.$eval(attrs.noPeriod);
                event.preventDefault();
            });
            event.preventDefault();
        }
    });
});

export interface INameAreaOptions {
    alttext?: string;
    collapse: boolean;
    collapsible: boolean;
    endtime?: string;
    hlevel: number;
    starttime?: string;
    timed?: boolean;
    title?: string;
}

class NameAreaController extends DialogController<{}, {areaName: string, options: INameAreaOptions}> {
    static component = "timNameArea";
    static $inject = ["$element", "$scope"] as const;
    private areaName: string;
    private options: INameAreaOptions;
    private datePickerOptions: {format: string; showTodayButton: boolean};

    constructor(protected element: IRootElementService, protected scope: IScope) {
        super(element, scope);
        this.areaName = "";
        this.options = {
            collapse: true,
            collapsible: false,
            hlevel: 0,
        };
        this.datePickerOptions = {
            format: "D.M.YYYY HH:mm:ss",
            showTodayButton: true,
        };
    }

    public getTitle() {
        return "Name area";
    }

    private addArea() {
        if (!this.areaName) {
            return;
        }
        this.close({areaName: this.areaName, options: this.options});
    }
}

registerDialogComponent(
    NameAreaController,
    {templateUrl: "/static/templates/nameArea.html"});

export async function showNameAreaDialog() {
    return await showDialog(NameAreaController, {}).result;
}
