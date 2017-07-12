import {IController} from "angular";
import $ from "jquery";
import {timApp} from "tim/app";
import {Users, UserService} from "../services/userService";
import {$http, $log, $window} from "../ngimport";
import {ILecture, ILectureListResponse2} from "../lecturetypes";

/**
 * FILL WITH SUITABLE TEXT
 * @module sidebarMenuCtrl
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

export class SidebarMenuCtrl implements IController {
    private currentLecturesList: ILecture[];
    private futureLecturesList: ILecture[];
    private pastLecturesList: ILecture[];
    private lectureQuestions: {}[];
    private materialQuestions: {}[];
    private users: UserService;
    private leftSide: JQuery;
    private active: number;
    private lastTab: number;
    private bookmarks: {};
    private docId: number;

    constructor() {
        this.currentLecturesList = [];
        this.futureLecturesList = [];
        this.pastLecturesList = [];
        this.lectureQuestions = [];
        this.materialQuestions = [];
        this.users = Users;
        this.bookmarks = $window.bookmarks; // from base.html
        this.leftSide = $(".left-fixed-side");

        this.active = -1;
        if ($window.showIndex) {
            this.active = 0;
        } else if (Users.isLoggedIn()) {
            // make bookmarks tab active
            this.active = 6;
        }
        this.lastTab = this.active;

        this.updateLeftSide();
        $($window).resize(() => this.updateLeftSide());
    }

    updateLeftSide() {
        if ($("#menuTabs").is(":visible")) {
            this.leftSide.css("min-width", "12em");
        } else {
            this.leftSide.css("min-width", "0");
        }
    }

    bookmarkTabSelected(isSelected: boolean) {
        const tabContent = $("#menuTabs").find(".tab-content");
        if (isSelected) {
            // The dropdown menu is clipped if it's near right side of the menu without applying this hack
            // Also the dropdown menu causes vertical scrollbar to appear without specifying height
            tabContent.css("height", "calc(100vh - 51.2833px)");
            tabContent.css("overflow-x", "visible");
            tabContent.css("overflow-y", "visible");
        } else {
            tabContent.css("height", "auto");
            tabContent.css("overflow-x", "hidden");
            tabContent.css("overflow-y", "auto");
        }
    }

    /**
     * FILL WITH SUITABLE TEXT
     * @memberof module:sidebarMenuCtrl
     */
    showSidebar() {
        const tabs = $("#menuTabs");
        if (tabs.is(":visible")) {
            if (this.active !== null) {
                this.lastTab = this.active;
                this.active = -1; // this will set the value to null and remove the "selected" state from tab
                if ($(".device-xs").is(":visible") || $(".device-sm").is(":visible")) {
                    tabs.hide();
                    this.leftSide.css("min-width", "0");
                }
            } else {
                this.active = this.lastTab;
            }
        } else {
            tabs.show();
            this.leftSide.css("min-width", "12em");
            tabs.attr("class", "");
            if (this.active === null) {
                this.active = this.lastTab || 0;
            }
        }
    }

    /**
     * FILL WITH SUITABLE TEXT
     * @memberof module:sidebarMenuCtrl
     */
    async toggleLectures() {
        const response = await $http<ILectureListResponse2>({
            url: "/getAllLecturesFromDocument",
            method: "GET",
            params: {doc_id: this.docId},
        });
        const lectures = response.data;
        this.currentLecturesList = lectures.currentLectures;
        this.futureLecturesList = lectures.futureLectures;
        this.pastLecturesList = lectures.pastLectures;
    }

    /**
     * FILL WITH SUITABLE TEXT
     * @memberof module:sidebarMenuCtrl
     */
    toggleQuestions() {
        // Does not work anymore after changing questions part of document
        this.lectureQuestions = [];
        $http<Array<{question_id, questionjson}>>({
            url: "/questions/" + this.docId,
            method: "GET",
        })
            .then((response) => {
                const questions = response.data;
                for (let i = 0; i < questions.length; i++) {
                    const question = {
                        questionId: questions[i].question_id,
                        questionTitle: (JSON.parse(questions[i].questionjson)).questionTitle,
                    };
                    this.lectureQuestions.push(question);
                }
            }, () => {
                $log.error("Couldn't fetch the questions");
            });
    }
}

timApp.component("timSidebarMenu", {
    controller: SidebarMenuCtrl,
    require: {
        lctrl: "?^timLectureView",
        vctrl: "?^timView",
    },
    template: "<div ng-transclude></div>",
    transclude: true,
});
