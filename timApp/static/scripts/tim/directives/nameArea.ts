import {IRootElementService, IController} from "angular";
import $ from "jquery";
import {timApp} from "tim/app";

timApp.directive('noPeriod', function() {
    return function(scope, element, attrs) {

        var keyCode = [190, 188, 110]; // . keycode
        element.bind("keydown", function(event) {
            //console.log($.inArray(event.which,keyCode));
            if ($.inArray(event.which, keyCode) !== -1) {
                scope.$apply(function() {
                    scope.$eval(attrs.noPeriod);
                    event.preventDefault();
                });
                event.preventDefault();
            }

        });
    };
});

export interface INameAreaOptions {
    collapse: boolean;
    hlevel: number;
}

class NameAreaController implements IController {
    private static $inject = ["$element"];
    private $area: JQuery;
    private areaName: string;
    private options: INameAreaOptions;
    private datePickerOptions: {format: string; showTodayButton: boolean};
    private element: IRootElementService;
    private onClose: (e: JQuery) => void;
    private onCancel: (e: JQuery) => void;
    private onOk: (area: JQuery, name: string, options: INameAreaOptions) => void;

    constructor(element: IRootElementService) {
        this.element = element;
        this.$area = element.parents(".area").first();

        const area = $("#areaname");
        area.keypress((e) => {
            if (e.which == 13) {
                this.addArea();
            }
        });

        this.areaName = "";
        this.options = {collapse: true, hlevel: 0};
        element.css("position", "absolute"); // IE needs this
        this.datePickerOptions = {
            format: "D.M.YYYY HH:mm:ss",
            showTodayButton: true,
        };

        area.focus();
    }

    $onInit() {

    }

    closePopup() {
        this.element.remove();

        if (this.onClose) {
            this.onClose(this.$area);
        }
    }

    addArea() {
        this.closePopup();

        if (this.onOk) {
            this.onOk(this.$area, this.areaName, this.options);
        }
    }

    cancelAdd() {
        this.closePopup();

        if (this.onCancel) {
            this.onCancel(this.$area);
        }
    }
}

/**
 * A popup window directive that is used in the document view
 * when creating a new area.
 */
timApp.component("nameArea", {
    bindings: {
        onCancel: "&",
        onClose: "&",
        onOk: "&",
    },
    controller: NameAreaController,
    templateUrl: "/static/templates/nameArea.html",
});
