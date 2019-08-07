/**
 * Defines the client-side implementation of JavaScript runner plugin.
 */
import * as t from "io-ts";
import {PluginBase, pluginBindings} from "tim/plugin/util";
import {timApp} from "../app";
import {onClick} from "../document/eventhandlers";
import {ViewCtrl} from "../document/viewctrl";
import {IRights} from "../user/IRights";
import {Require} from "../util/utils";
import {GenericPluginMarkup, Info, nullable, withDefault} from "./attributes";
import "./timMenu.css";

// this.attrs
const TimMenuMarkup = t.intersection([
    t.partial({
        backgroundColor: nullable(t.string),
        textColor: nullable(t.string),
        fontSize: nullable(t.string),
    }),
    GenericPluginMarkup,
    t.type({
        menu: withDefault(t.string, ""),
        hoverOpen: withDefault(t.boolean, true), // Unimplemented.
        topMenu: withDefault(t.boolean, false),
        openAbove: withDefault(t.boolean, false),
        basicColors: withDefault(t.boolean, false),
        separator: withDefault(t.string, "&nbsp;"), // Non-breaking space
        openingSymbol: withDefault(t.string, "&#9662;"), // Caret
    }),
]);

interface ITimMenuItem {
    height?: string;
    id: string;
    items?: ITimMenuItem[];
    level: number;
    open: boolean;
    rights?: string;
    text: string;
    width?: string;
}

const ITimMenuItem: t.Type<ITimMenuItem> = t.recursion("ITimMenuItem", () =>
    t.intersection([
        t.partial({
            height: t.string,
            items: t.array(ITimMenuItem),
            rights: t.string,
            width: t.string,
        }),
        t.type({
            id: t.string,
            level: t.number,
            open: t.boolean,
            text: t.string,
        })]),
);

const TimMenuAll = t.intersection([
    t.partial({
        menu: t.array(ITimMenuItem),
    }),
    t.type({
        info: Info,
        markup: TimMenuMarkup,
        preview: t.boolean,
    }),
]);

class TimMenuController extends PluginBase<t.TypeOf<typeof TimMenuMarkup>, t.TypeOf<typeof TimMenuAll>, typeof TimMenuAll> {
    private menu: ITimMenuItem[] = [];
    private vctrl?: Require<ViewCtrl>;
    private openingSymbol: string = "";
    // private hoverOpen: boolean = true;
    private separator: string = "";
    private topMenu: boolean = false;
    private basicColors: boolean = false;
    private openAbove: boolean = false;
    private previousScroll: number | undefined = 0; // Store y-value of previous scroll event for comparison.
    private previouslyClicked: ITimMenuItem | undefined;
    private barStyle: string = "";
    private mouseInside: boolean = false; // Whether mouse cursor is inside the menu.
    private userRights: IRights | undefined;

    getDefaultMarkup() {
        return {};
    }

    $onInit() {
        super.$onInit();
        if (this.vctrl == null) {
            return;
        }
        if (!this.attrsall.menu) {
            return;
        }
        this.menu = this.attrsall.menu;
        // this.hoverOpen = this.attrs.hoverOpen;
        this.separator = this.attrs.separator;
        this.topMenu = this.attrs.topMenu;
        this.openAbove = this.attrs.openAbove;
        this.basicColors = this.attrs.basicColors;
        this.openingSymbol = this.attrs.openingSymbol;
        // Turn default symbol upwards if menu opens above.
        if (this.attrs.openAbove && this.openingSymbol == "&#9662;") {
            this.openingSymbol = "&#9652;";
        }
        if (this.topMenu) {
            window.onscroll = () => this.toggleSticky();
        }
        this.setBarStyles();
        onClick("body", ($this, e) => {
            this.onClick(e);
        });
        this.userRights = this.vctrl.item.rights;
    }

    protected getAttributeType() {
        return TimMenuAll;
    }

    /**
     * Close other menus and toggle clicked menu open or closed.
     * TODO: Better way to do this (for deeper menus).
     * @param item Clicked menu item.
     * @param parent1 Closest menu item parent.
     * @param parent2 Further menu item parent.
     */
    toggleSubmenu(item: ITimMenuItem, parent1: ITimMenuItem | undefined, parent2: ITimMenuItem | undefined) {
        // Toggle open menu closed and back again when clicking.
        if (this.previouslyClicked && (this.previouslyClicked === item || item.open)) {
            item.open = !item.open;
            this.previouslyClicked = item;
            return;
        }
        // Close all menus when clicking menu that isn't child of previously clicked.
        if (parent1 && parent1 !== this.previouslyClicked) {
            for (const menu of this.menu) {
                this.closeAllInMenuItem(menu);
            }
            parent1.open = true;
            if (parent2) {
                parent2.open = true;
            }
        }
        // A first level menu doesn't have a parent; close all other menus.
        if (!parent1 && item !== this.previouslyClicked) {
            for (const menu of this.menu) {
                this.closeAllInMenuItem(menu);
            }
        }
        // Unless already open, clicked item always opens.
        item.open = true;
        this.previouslyClicked = item;
    }

    /**
     * Closes all levels of a menu item recursively.
     * @param t1 First level menu item.
     */
    closeAllInMenuItem(t1: ITimMenuItem) {
        t1.open = false;
        if (!t1.items) {
            return;
        }
        for (const t2 of t1.items) {
            this.closeAllInMenuItem(t2);
        }
    }

    /**
     * Makes the element show at top when scrolling towards it from below.
     */
    toggleSticky() {
        // TODO: Multiple topMenus.
        // TODO: Placeholder content takes text-sized space even when hidden.
        const menu = this.element.find(".tim-menu")[0];
        const placeholder = this.element.find(".tim-menu-placeholder")[0];
        const scrollY = $(window).scrollTop();
        if (!menu || !placeholder) {
            return;
        }
        // Placeholder and its content are separate, because when hidden y is 0.
        const placeholderContent = this.element.find(".tim-menu-placeholder-content")[0];
        // Sticky can only show when the element's place in document goes outside upper bounds.
        if (scrollY && placeholder.getBoundingClientRect().bottom < 0) {
            // When scrolling downwards, don't show fixed menu and hide placeholder content.
            // Otherwise (i.e. scrolling upwards), show menu as fixed and let placeholder take its place in document
            // to mitigate page length changes.
            if (this.previousScroll && scrollY > this.previousScroll) {
                menu.classList.remove("top-menu");
                placeholderContent.classList.add("tim-menu-hidden");
            } else {
                menu.classList.add("top-menu");
                placeholderContent.classList.remove("tim-menu-hidden");
            }
        } else {
            menu.classList.remove("top-menu");
            placeholderContent.classList.add("tim-menu-hidden");
        }
        this.previousScroll = $(window).scrollTop();
    }

    /**
     * Set styles for menu bar defined in optional attributes.
     */
    private setBarStyles() {
        if (this.attrs.backgroundColor) {
            this.barStyle += `background-color: ${this.attrs.backgroundColor}; `;
        }
        if (this.attrs.textColor) {
            // TODO: Doesn't override links even with !important.
            this.barStyle += `color: ${this.attrs.textColor}; `;
        }
        if (this.attrs.fontSize) {
            this.barStyle += `font-size: ${this.attrs.fontSize}; `;
        }
    }

    /**
     * Sets style based on the object's attributes.
     * @param item Menu item.
     */
    private setStyle(item: ITimMenuItem) {
        let style = "";
        if (item.width) {
            style += `width: ${item.width}; `;
        }
        if (item.height) {
            style += `height: ${item.height}; `;
        }
        return style;
    }

    /**
     * Checks whether the user has required rights to see the menu item.
     * If no requirements have been set, return true.
     * @param item Menu item.
     */
    private hasRights(item: ITimMenuItem) {
        // TODO: Limit the amount of checks.
        // If item has no set rights, show to everyone.
        if (!item.rights) {
            return true;
        }
        if (this.userRights) {
            if (item.rights == "edit") {
                return this.userRights.editable;
            }
            if (item.rights == "manage") {
                return this.userRights.manage;
            }
            if (item.rights == "owner") {
                return this.userRights.owner;
            } else {
                // Return true, if user has none of the supported rights.
                // View not included, since it's redundant: without view the whole document is hidden.
                return true;
            }
        } else {
            // Non-logged in users who see the page have only view rights.
            return (!(item.rights == "edit" || item.rights == "manage" || item.rights == "owner"));
        }
    }

    /**
     * Decide what direction submenus open towards.
     * @param id Element id.
     */
    private openDirection(id: string) {
        // tslint:disable-next-line: prefer-const
        let horizontal = ""; // Default: centered.
        let vertical = ""; // Default: below.
        // If true, opens all menus above.
        if (this.openAbove) {
            vertical = "tim-menu-up";
        }
        return `${horizontal} ${vertical}`;
    }

    /**
     * Closes the menu structure if mouse is outside all menu elements.
     * @param e Click event.
     */
    private onClick(e: JQuery.Event) {
        if (!this.mouseInside) {
            for (const t1 of this.menu) {
                this.closeAllInMenuItem(t1);
            }
            // Plugin won't update if clicked outside document area without this.
            this.scope.$evalAsync();
        }
    }
}

timApp.component("timmenuRunner", {
    bindings: pluginBindings,
    controller: TimMenuController,
    require: {
        vctrl: "^timView",
    },
    template: `
<tim-markup-error ng-if="::$ctrl.markupError" data="::$ctrl.markupError"></tim-markup-error>
<span ng-cloak ng-if="$ctrl.topMenu" class="tim-menu-placeholder"></span>
<span ng-cloak ng-if="$ctrl.topMenu" class="tim-menu-placeholder-content tim-menu-hidden"><br></span>
<div id="{{$ctrl.menuId}}" class="tim-menu" ng-class="{'bgtim white': $ctrl.basicColors}" style="{{$ctrl.barStyle}}" ng-mouseleave="$ctrl.mouseInside = false" ng-mouseenter="$ctrl.mouseInside = true">
    <span ng-repeat="t1 in $ctrl.menu">
        <span ng-if="t1.items.length > 0 && $ctrl.hasRights(t1)" class="btn-group" style="{{$ctrl.setStyle(t1)}}">
          <span ng-disabled="disabled" ng-bind-html="t1.text+$ctrl.openingSymbol" ng-click="$ctrl.toggleSubmenu(t1, undefined, undefined)"></span>
          <ul class="tim-menu-dropdown" ng-if="t1.open" ng-class="$ctrl.openDirection(t1.id)" id="{{t1.id}}">
            <li class="tim-menu-list-item" ng-repeat="t2 in t1.items" style="{{$ctrl.setStyle(t2)}}">
                <span class="tim-menu-item" ng-if="t2.items.length > 0 && $ctrl.hasRights(t2)">
                    <span class="tim-menu-item" ng-bind-html="t2.text+$ctrl.openingSymbol" ng-click="$ctrl.toggleSubmenu(t2, t1, undefined)"></span>
                    <ul class="tim-menu-dropdown" id="{{t2.id}}" ng-class="$ctrl.openDirection(t2.id)" ng-if="t2.open">
                        <li class="tim-menu-list-item" ng-repeat="t3 in t2.items" style="{{$ctrl.setStyle(t3)}}">
                            <span class="tim-menu-item" ng-if="t3.items.length > 0 && $ctrl.hasRights(t3)">
                                <span class="tim-menu-item" ng-bind-html="t3.text+$ctrl.openingSymbol" ng-click="$ctrl.toggleSubmenu(t3, t2, t1)"></span>
                                <ul class="tim-menu-dropdown" id="{{t3.id}}" ng-class="$ctrl.openDirection(t3.id)" ng-if="t3.open">
                                    <li class="tim-menu-list-item" ng-repeat="t4 in t3.items" ng-bind-html="t4.text" style="{{$ctrl.setStyle(t4)}}" ng-if="$ctrl.hasRights(t4)"></li>
                                </ul>
                            </span>
                            <span class="tim-menu-item" ng-if="t3.items.length < 1  && $ctrl.hasRights(t3)" ng-bind-html="t3.text"></span>
                        </li>
                    </ul>
                </span>
                <span class="tim-menu-item" ng-if="t2.items.length < 1 && $ctrl.hasRights(t2)" ng-bind-html="t2.text"></span>
            </li>
          </ul>
        </span>
        <span ng-if="t1.items.length < 1 && $ctrl.hasRights(t1)" class="btn-group" style="{{$ctrl.setStyle(t1)}}" ng-bind-html="t1.text"></span>
        <span ng-if="!$last && $ctrl.hasRights(t1)" ng-bind-html="$ctrl.separator"></span>
    </span>
</div>
`,
});
