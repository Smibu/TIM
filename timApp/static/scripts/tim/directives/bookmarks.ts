import angular from "angular";
import {IController} from "angular";
import {timApp} from "tim/app";
import * as focusMe from "tim/directives/focusMe";
import {markAsUsed} from "tim/utils";
import {$http, $timeout, $uibModal, $window} from "../ngimport";
import {IItem} from "../IItem";

markAsUsed(focusMe);

export interface IBookmarkGroup {
    name: string;
    isOpen: boolean;
    items: IBookmark[]
}

export interface IBookmark {
    group: string;
    link: string;
}

class BookmarksController implements IController {
    private data: IBookmarkGroup[];
    private deleting: boolean;
    private userId: number;

    constructor() {
        if ($window.bookmarks && !this.data) {
            this.data = angular.copy($window.bookmarks);
        }
        this.deleting = false;

        if (this.userId && !this.data) {
            (async () => {
                const response = await $http.get<IBookmarkGroup[]>("/bookmarks/get/" + this.userId);
                this.getFromServer(response.data);
            })();
        }
    }

    $onInit() {

    }

    getFromServer(response: IBookmarkGroup[], groupToKeepOpen?: IBookmarkGroup) {
        this.data = response;
        this.keepGroupOpen(groupToKeepOpen);
    }

    keepGroupOpen(groupToKeepOpen?: IBookmarkGroup) {
        if (!groupToKeepOpen) {
            return;
        }
        for (let i = 0; i < this.data.length; ++i) {
            if (this.data[i].name === groupToKeepOpen.name) {
                this.data[i].isOpen = true;
                return;
            }
        }
    }

    getTopLevelBookmarks() {
        if (!this.data) {
            return [];
        }
        for (let i = 0; i < this.data.length; ++i) {
            if (this.data[i].name === "") {
                return this.data[i].items;
            }
        }
        return [];
    }

    isSaveablePage() {
        return true;
    }

    newBookmark(group: IBookmarkGroup, e: Event) {
        e.preventDefault();
        const suggestedName = ($window.item || {}).title || document.title;
        const modalInstance = $uibModal.open({
            animation: false,
            ariaLabelledBy: "modal-title",
            ariaDescribedBy: "modal-body",
            templateUrl: "createBookmark.html",
            controller: "CreateBookmarkCtrl",
            controllerAs: "$ctrl",
            size: "md",
            resolve: {
                bookmark() {
                    return {
                        group: group || "",
                        name: suggestedName,
                        link: "",
                    };
                },
            },
        });

        modalInstance.result.then((bookmark) => {
            if (!bookmark.name) {
                return;
            }
            $http.post<IBookmarkGroup[]>("/bookmarks/add", bookmark)
                .then((resp) => this.getFromServer(resp.data), (response) => {
                    $window.alert("Could not add bookmark.");
                });
        }, () => {
        });
    }

    editItem(group: IBookmarkGroup, item: IItem, e: Event) {
        e.stopPropagation();
        e.preventDefault();
        const modalInstance = $uibModal.open({
            animation: false,
            ariaLabelledBy: "modal-title",
            ariaDescribedBy: "modal-body",
            templateUrl: "createBookmark.html",
            controller: "CreateBookmarkCtrl",
            controllerAs: "$ctrl",
            size: "md",
            resolve: {
                bookmark() {
                    return {
                        group: group.name,
                        name: item.name,
                        link: item.path,
                    };
                },
            },
        });

        modalInstance.result.then((bookmark) => {
            if (!bookmark.name) {
                return;
            }
            $http.post<IBookmarkGroup[]>("/bookmarks/edit", {
                old: {
                    group: group.name,
                    name: item.name,
                    link: item.path,
                }, new: bookmark,
            })
                .then((response) => {
                    this.getFromServer(response.data, group);
                }, response => {
                    $window.alert("Could not edit bookmark.");
                });
        }, () => {
            $timeout(() => {
                this.keepGroupOpen(group);
            }, 0);
        });
    }

    deleteItem(group: IBookmarkGroup, item: IItem, e: Event) {
        e.stopPropagation();
        e.preventDefault();
        return $http.post<IBookmarkGroup[]>("/bookmarks/delete", {
            group: group.name,
            name: item.name,
        })
            .then((response) => {
                this.getFromServer(response.data, group);
            }, (response) => {
                $window.alert("Could not delete bookmark.");
            });
    }

    deleteGroup(group: IBookmarkGroup, e: Event) {
        e.stopPropagation();
        e.preventDefault();
        if ($window.confirm("Are you sure you want to delete this bookmark group?")) {
            $http.post<IBookmarkGroup[]>("/bookmarks/deleteGroup", {group: group.name})
                .then((resp) => this.getFromServer(resp.data), response => {
                    $window.alert("Could not delete bookmark group.");
                });
        }
    }

    toggleDelete(e: Event) {
        e.stopPropagation();
        e.preventDefault();
        this.deleting = !this.deleting;
    }
}

timApp.component("bookmarks", {
    bindings: {
        data: "=?",
        userId: "=?",
    },
    controller: BookmarksController,
    templateUrl: "/static/templates/bookmarks.html",
});

class CreateBookmarkCtrl implements IController {
    private static $inject = ["bookmark", "$uibModalInstance"];

    private bookmarkForm: {};
    private focusName: boolean;
    private focusGroup: boolean;
    private showParamsCheckbox: boolean;
    private showHashCheckbox: boolean;
    private bookmark: IBookmark;
    private includeParams: boolean;
    private includeHash: boolean;
    private uibModalInstance: angular.ui.bootstrap.IModalInstanceService;

    constructor(bookmark: IBookmark, uibModalInstance: angular.ui.bootstrap.IModalInstanceService) {
        this.uibModalInstance = uibModalInstance;
        this.bookmarkForm = {};
        this.bookmark = bookmark;
        if (bookmark.group === "Last edited" || bookmark.group === "Last read") {
            bookmark.group = "";
        }
        this.focusGroup = false;
        this.focusName = true;
        this.showParamsCheckbox = $window.location.search.length > 1;
        this.showHashCheckbox = $window.location.hash.length > 1;
    }

    $onInit() {

    }

    public ok() {
        if (!this.bookmark.link) {
            this.bookmark.link = $window.location.pathname;
            if (this.includeParams) {
                this.bookmark.link += $window.location.search;
            }
            if (this.includeHash) {
                this.bookmark.link += $window.location.hash;
            }
        }

        this.uibModalInstance.close(this.bookmark);
    }

    public cancel() {
        this.uibModalInstance.dismiss("cancel");
    }
}

timApp.controller("CreateBookmarkCtrl", CreateBookmarkCtrl);
