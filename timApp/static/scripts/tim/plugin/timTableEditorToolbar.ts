import angular, {IController, IFormController, IHttpPromise, IPromise, IRootElementService, IScope} from "angular";
import {DialogController, registerDialogComponent, showDialog, showMessageDialog} from "../ui/dialog";
import {ILectureFormParams} from "../lecture/lecturetypes";
import {IEditorParams, IEditorResult, PareditorController} from "../editor/pareditor";

export interface TimTableToolbarCallbacks {
    setTextAlign: (value: string) => void,
    setCellBackgroundColor: (value: string) => void,
}

export interface timTableEditorToolbarParams {
    callbacks: TimTableToolbarCallbacks;
    activeTable: object;
}

let instance: TimTableEditorToolbarController | null = null;

export class TimTableEditorToolbarController extends DialogController<{params: timTableEditorToolbarParams},
    { }, "timTableEditorToolbar" > {
    private static $inject = ["$scope", "$element"];

    readonly DEFAULT_CELL_BGCOLOR = "#EEEEEE";

    constructor(protected scope: IScope, protected element: IRootElementService) {
        super(element, scope);
        instance = this;
        this.callbacks = this.resolve.params.callbacks;
        this.activeTable = this.resolve.params.activeTable;
    }

    $onInit() {
        super.$onInit();
        this.draggable.setCloseFn(undefined); // Hides the close button
    }

    /**
     * Checks for changes in the cell background color selector.
     */
    $doCheck() {

        /* replaced by onColorPickerClose
        if (this.cellBackgroundColor !== this.previousBackgroundColor) {
            this.previousBackgroundColor = this.cellBackgroundColor;
            this.callbacks.setCellBackgroundColor("#" + this.cellBackgroundColor);
            this.scope.$apply();
        } */
    }

    public callbacks: TimTableToolbarCallbacks;
    private activeTable?: object;
    private visible: boolean = true;

    private previousBackgroundColor: string = this.DEFAULT_CELL_BGCOLOR;
    private cellBackgroundColor: string = this.DEFAULT_CELL_BGCOLOR;

    public getTitle() {
        return "Edit table";
    }

    dismiss() {
        this.hide();
    }

    /**
     * Hides the toolbar and removes the instance.
     */
    public hide() {
        this.close("");
        this.visible = false;
        this.scope.$apply();
        instance = null;
    }

    public hideIfActiveTable(table: object) {
        if (table == this.activeTable) {
            this.hide();
        }
    }

    /**
     * Shows the toolbar.
     * @param callbacks Callbacks for communicating with the table.
     * @param activeTable The object that requested the toolbar to open.
     */
    public show(callbacks: TimTableToolbarCallbacks, activeTable: object) {
        this.visible = true;
        this.activeTable = activeTable;
        this.callbacks = callbacks;
    }

    /**
     * Sets the color of the toolbar's color picker object.
     * @param color The color.
     */
    public setColorPickerColor(color: string) {
        this.cellBackgroundColor = color;
    }

    /**
     * Sets the text-align value of a cell.
     */
    private setTextAlign(value: string) {
        this.callbacks.setTextAlign(value);
    }

    private eventApi = {
        onClose: function(api: any, color: string, $event: any) {TimTableEditorToolbarController.onColorPickerClose(color);},
    };

    /**
     * Updates the color of a cell when the color picker is closed.
     * @param color The color.
     */
    private static onColorPickerClose(color: string) {
        if (instance) {
            instance.previousBackgroundColor = instance.cellBackgroundColor;
            instance.callbacks.setCellBackgroundColor("#" + color);
        }
    }

    private getStyle() {
        return {'background-color': "#" + this.previousBackgroundColor};
    }

    private applyBackgroundColor() {
        this.callbacks.setCellBackgroundColor("#" + this.previousBackgroundColor);
    }
}

// : IPromise< { } >
export function openTableEditorToolbar(p: timTableEditorToolbarParams) {
    if (instance) {
        instance.show(p.callbacks, p.activeTable);
    } else {
        showDialog<TimTableEditorToolbarController>(
        "timTableEditorToolbar",
        {params: () => p},
        {forceMaximized: false});
    }
}

export function hideToolbar(closingTable: object) {
    if (instance) {
        //instance.hideIfActiveTable(closingTable);
        instance.hide();
    }
}

registerDialogComponent("timTableEditorToolbar",
    TimTableEditorToolbarController,
    {
        template: `
  <div >
    <div class="timTableEditorToolbar">
        <color-picker class="timtable-colorpicker" ng-model="$ctrl.cellBackgroundColor" event-api="$ctrl.eventApi"
        options="{'format':'hex', 'placeholder': '#EEEEEE', 'round': false}"></color-picker>
        <button ng-style="$ctrl.getStyle()" ng-click="$ctrl.applyBackgroundColor()">Apply color</button>
        <button class="glyphicon glyphicon-align-left" title="Align left" ng-click="$ctrl.setTextAlign('left')"></button>
        <button class="glyphicon glyphicon-align-center" title="Align center" ng-click="$ctrl.setTextAlign('center')"></button>
        <button class="glyphicon glyphicon-align-right" title="Align right" ng-click="$ctrl.setTextAlign('right')"></button>
        <!--- <button class="editorButton" title="Align left" ng-click="$ctrl.alignLeft()"><span
                class="glyphicon glyphicon-align-left"></span></button>
        <button class="editorButton" title="Align center" ng-click="$ctrl.alignCenter()"><span
                class="glyphicon glyphicon-align-center"></span></button>
        <button class="editorButton" title="Align right" ng-click="$ctrl.alignRight()"><span
                class="glyphicon glyphicon-align-right"></span></button> --->
    </div>
  </div>

<!--- <tim-dialog>
    <dialog-header>aaa
        Lecture ends in
        <timer interval="1000"
               max-time-unit="'day'"
               end-time="$ctrl.resolve.lecture.end_time">
            {{ days > 0 ? days + ' day' + daysS + ' +' : '' }} {{ hhours }}:{{ mminutes }}:{{ sseconds }}
        </timer>
    </dialog-header>
    <dialog-body>
        <form>
            <label> Extend by
                <select ng-model="$ctrl.selectedTime" ng-options="choice for choice in $ctrl.extendTimes">
                </select>
                minutes
            </label>
        </form>
    </dialog-body>
    <dialog-footer>
        <button class="timButton" autofocus ng-click="$ctrl.extend()">Extend</button>
        <button class="timButton" ng-show="!$ctrl.hasLectureEnded()" ng-click="$ctrl.end()">End</button>
        <button
                class="timButton"
                ng-show="$ctrl.hasLectureEnded()"
                ng-click="$ctrl.noExtend()">Don't extend
        </button>
    </dialog-footer>
</tim-dialog> --->
`,
    });