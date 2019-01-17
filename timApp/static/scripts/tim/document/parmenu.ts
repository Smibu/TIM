import {IScope} from "angular";
import $ from "jquery";
import {getCitePar} from "../editor/pareditor";
import {showMessageDialog} from "../ui/dialog";
import {Coords, dist, getPageXY, to} from "../util/utils";
import {onClick} from "./eventhandlers";
import {getParId, getPreambleDocId, isActionablePar, isPreamble, Paragraph} from "./parhelpers";
import {EditMode, showPopupMenu} from "./popupMenu";
import {ViewCtrl} from "./viewctrl";
import {getEmptyCoords, MenuFunctionList} from "./viewutils";

function selectionToStr(selection: JQuery) {
    return selection.toArray().map((e) => "#" + e.id).join(",");
}

export class ParmenuHandler {
    public sc: IScope;
    public viewctrl: ViewCtrl;
    public lastclicktime: number | undefined;
    public lastclickplace: Coords | undefined;

    constructor(sc: IScope, view: ViewCtrl) {
        this.sc = sc;
        this.viewctrl = view;
        onClick(".paragraphs .parContent", ($this, e) => {
            if (this.viewctrl.editing) {
                return false;
            }

            const target = $(e.target);
            const tag = target.prop("tagName");
            const par = $this.parents(".par");
            if (!isActionablePar(par)) {
                return;
            }

            // Don't show paragraph menu on these specific tags or classes
            const ignoredTags = ["BUTTON", "INPUT", "TEXTAREA", "A", "QUESTIONADDEDNEW"];
            const ignoredClasses = ["no-popup-menu", "ace_editor"];
            const classSelector = ignoredClasses.map((c) => "." + c).join(",");
            if (ignoredTags.indexOf(tag) > -1 || target.parents(classSelector).length > 0) {
                return false;
            }

            if (this.viewctrl.selection.start != null) {
                this.viewctrl.editingHandler.extendSelection(par, true);
            } else {
                const offset = par.offset() || getEmptyCoords();
                const coords = {left: e.pageX - offset.left, top: e.pageY - offset.top};
                const toggle1 = !par.hasClass("lightselect");
                const toggle2 = par.hasClass("lightselect") && !this.isCloseMenuDefault();

                $(".par.selected").removeClass("selected");
                $(".par.lightselect").removeClass("lightselect");
                this.viewctrl.closePopupIfOpen();
                this.toggleActionButtons(e, par, toggle1, toggle2, coords);
            }
            sc.$apply();
            return true;
        }, true);

        this.viewctrl.defaultAction = {
            desc: "Show options window",
            func: (e, p) => this.showOptionsWindow(e, p),
            show: true,
        };

        onClick(".editline", async ($this, e) => {
            await this.viewctrl.closePopupIfOpen();
            const par = $this.parent().filter(".par");
            if (isPreamble(par)) {
                const parId = getParId(par) || "";
                showMessageDialog(`
<p>This paragraph is from a preamble document.
To comment or edit this, go to the corresponding <a href="/view/${getPreambleDocId(par)}">preamble document</a>.</p>

<p>Citation help: <code>${getCitePar(this.viewctrl.item.id, parId)}</code></p>
`);
            }
            if (!isActionablePar(par)) {
                return;
            }
            if (this.viewctrl.selection.start != null) {
                this.viewctrl.editingHandler.extendSelection(par);
            }

            this.showOptionsWindow(e, par);
            return false;
        }, true);
    }

    private isCloseMenuDefault() {
        return this.viewctrl.defaultAction && this.viewctrl.defaultAction.desc === "Close menu";
    }

    async showPopupMenu(e: JQueryEventObject,
                        $pars: Paragraph,
                        attrs: {
                            actions: MenuFunctionList,
                            save: boolean,
                            contenturl?: string,
                            editbutton: boolean,
                        },
                        editcontext?: EditMode) {
        const p = {
            actions: attrs.actions,
            areaEditButton: $(".area").length > 0,
            contenturl: attrs.contenturl,
            editbutton: attrs.editbutton,
            editcontext: editcontext,
            pos: getPageXY(e),
            save: attrs.save,
            srcid: selectionToStr($pars),
            vctrl: this.viewctrl,
        };
        if (this.updatePopupMenuIfOpen(p)) {
            return;
        }
        await to(showPopupMenu(p));
        const editline = $(".menuopen");
        editline.removeClass("menuopen");
    }

    toggleActionButtons(e: JQueryEventObject, par: Paragraph, toggle1: boolean, toggle2: boolean, coords: Coords) {
        if (!this.viewctrl.item.rights.editable && !this.viewctrl.item.rights.can_comment) {
            return;
        }

        const target = $(e.target);
        const ignoredClasses = ["no-highlight"];
        const classSelector = ignoredClasses.map((c) => "." + c).join(",");
        if (target.parents(classSelector).length > 0) {
            return false;
        }

        if (toggle2 && this.lastclickplace && this.lastclicktime) {
            // Clicked twice successively
            const clicktime = new Date().getTime() - this.lastclicktime;
            const clickdelta = dist(coords, this.lastclickplace);
            par.addClass("selected");

            if (clickdelta > 10) {
                // Selecting text
                par.removeClass("selected");
                par.removeClass("lightselect");
            } else if (clicktime < 500 && this.viewctrl.defaultAction != null) {
                // Double click
                this.viewctrl.defaultAction.func(e, par, coords);
            } else {
                // Two clicks but they were too slow; do nothing.
            }
        } else if (toggle1) {
            // Clicked once
            par.addClass("lightselect");
            this.lastclicktime = new Date().getTime();
            this.lastclickplace = coords;
        } else {
            par.removeClass("selected");
            par.removeClass("lightselect");
        }
    }

    showOptionsWindow(e: JQueryEventObject, par: Paragraph) {
        this.viewctrl.clipboardHandler.updateClipboardStatus();
        const result = this.getPopupAttrs(par);
        par.children(".editline").addClass("menuopen");
        this.showPopupMenu(e, par, result, "par");
    }

    updatePopupMenuIfOpen(attrs: {
        actions: MenuFunctionList,
        save: boolean,
        contenturl?: string,
        editbutton: boolean,
    }) {
        if (this.viewctrl.popupmenu) {
            this.viewctrl.popupmenu.updateAttrs(attrs);
            return true;
        }
        return false;
    }

    getPopupAttrs(par?: Paragraph) {
        const fns = this.viewctrl.editingHandler.getEditorFunctions(par);
        const hasSelectionAndEditMode = this.viewctrl.item.rights.editable;
        return {
            actions: fns,
            editbutton: hasSelectionAndEditMode,
            save: hasSelectionAndEditMode,
        };
    }
}
