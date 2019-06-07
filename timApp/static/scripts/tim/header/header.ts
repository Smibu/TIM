import {IController} from "angular";
import moment from "moment";
import {timApp} from "../app";
import {IBookmarkGroup} from "../bookmark/bookmarks";
import {IDocSettings} from "../document/IDocSettings";
import {ViewCtrl} from "../document/viewctrl";
import {DocumentOrFolder, isRootFolder, ITag, ITranslation, TagType} from "../item/IItem";
import {showMessageDialog} from "../ui/dialog";
import {Users} from "../user/userService";
import {$http, $window} from "../util/ngimport";
import {capitalizeFirstLetter, to} from "../util/utils";

/**
 * Checks if the tag type is course code.
 * @param {string} tag
 * @returns {boolean} Whether the tag has course code tag.
 */
function isCourse(tag: ITag) {
    return tag.type === TagType.CourseCode;
}

const courseFolder = "My courses";

/**
 * Checks if the tag has expired.
 * @param {string} tag
 * @returns {boolean} False if the tag has no expiration or hasn't yet expired.
 */
function isExpired(tag: ITag) {
    return tag.expires && tag.expires.diff(moment.now()) < 0;
}

interface IItemLink {
    route: string;
    title: string;
}

class HeaderController implements IController {
    // To show a button that adds the document to bookmark folder 'My courses'.
    private taggedAsCourse = false;
    private item: DocumentOrFolder = $window.item;
    private bookmarked: boolean = false;
    private bookmarks: IBookmarkGroup[] = [];
    private viewctrl?: ViewCtrl;
    private route?: string;
    private itemLinks!: IItemLink[];
    private translations: ITranslation[] = $window.translations;
    private crumbs = $window.breadcrumbs;
    private docSettings?: IDocSettings = $window.docSettings;

    $onInit() {
        this.route = document.location.pathname.split("/")[1];
        const allowedRoutes = ["view"];
        if (!isRootFolder(this.item)) {
            allowedRoutes.push("manage");
        }
        if (!this.item.isFolder) {
            if (this.item.rights.teacher) {
                allowedRoutes.push("teacher");
            }
            if (this.item.rights.see_answers) {
                allowedRoutes.push("answers");
            }
            allowedRoutes.push("lecture", "velp", "slide");
        }
        this.itemLinks = allowedRoutes.map((r) => ({route: r, title: capitalizeFirstLetter(r)}));
        void this.checkIfTaggedAsCourse();
        void this.checkIfBookmarked();
    }

    isActive(i: IItemLink) {
        return this.route === i.route;
    }

    getMainCourseDocPath() {
        if (this.docSettings && this.docSettings.course_main) {
            return this.docSettings.course_main;
        }
        return this.item.path;
    }

    /**
     * Checks if the document has been tagged as a course and the tag hasn't expired.
     */
    private async checkIfTaggedAsCourse() {
        this.taggedAsCourse = false;
        const r = await to($http.get<ITag[]>(`/tags/getTags/${this.getMainCourseDocPath()}`));
        if (r.ok) {
            for (const tag of r.result.data) {
                if (isCourse(tag)) {
                    if (!isExpired(tag)) {
                        this.taggedAsCourse = true;
                    }
                    return;
                }
            }
        }
    }

    /**
     * Adds the current page to course bookmark folder.
     */
    async addToBookmarkFolder() {
        if (!Users.isLoggedIn()) {
            showMessageDialog("Log in to bookmark this course");
            return;
        }
        if (!this.viewctrl) {
            return;
        }
        if (!this.viewctrl.bookmarksCtrl) {
            throw new Error("Bookmarkscontroller not registered");
        }
        const bookmark = {path: `${this.getMainCourseDocPath()}`};
        await $http.post<IBookmarkGroup[]>("/bookmarks/addCourse", bookmark);
        await this.viewctrl.bookmarksCtrl.refresh();
        this.checkIfBookmarked(); // Instead of directly changing boolean this checks if it really was added.
    }

    /**
     * Marks page as bookmarked if it's in the course bookmark folder.
     */
    private async checkIfBookmarked() {
        this.bookmarked = false;
        if (!Users.isLoggedIn()) {
            return;
        }
        const response = await $http.get<IBookmarkGroup[]>("/bookmarks/get");
        this.bookmarks = response.data;
        for (const folder of this.bookmarks) {
            if (folder.name === courseFolder) {
                for (const bookmark of folder.items) {
                    if (bookmark.link === `/view/${this.getMainCourseDocPath()}`) {
                        this.bookmarked = true;
                        return;
                    }
                }
            }
        }
    }

    showAddToMyCourses() {
        return this.taggedAsCourse && !this.bookmarked;
    }
}

timApp.component("timHeader", {
    controller: HeaderController,
    require: {
        viewctrl: "?^timView",
    },
    template: `
<div ng-if="::!$ctrl.hideLinks && $ctrl.item">
    <div class="pull-right">
        <button ng-cloak
                ng-if="$ctrl.showAddToMyCourses()"
                ng-click="$ctrl.addToBookmarkFolder()"
                title="Add this page to 'My courses' bookmark folder"
                class="timButton label">
            Add to My courses
        </button>
        <span ng-repeat="tr in ::$ctrl.translations">
        <a class="label label-primary"
           href="/{{ ::$ctrl.route }}/{{ ::tr.path }}">{{ ::tr.lang_id }}</a> </span>
    </div>
    <div class="nav nav-tabs">
        <li ng-repeat="link in ::$ctrl.itemLinks"
            role="presentation"
            ng-class="::{active: $ctrl.isActive(link)}">
            <a href="/{{ ::link.route }}/{{ $ctrl.item.path }}">{{ ::link.title }}</a>
        </li>
    </div>
    <ol class="breadcrumb">
        <li ng-repeat="c in ::$ctrl.crumbs | orderBy:'-'">
            <a href="/{{ ::$ctrl.route }}/{{ c.path | escape }}">{{ ::c.title }}</a>
        </li>
        <li class="active">{{ ::$ctrl.item.title }}</li>
    </ol>
</div>
`,
});
