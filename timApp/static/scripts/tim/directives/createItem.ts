import angular from "angular";
import {IController} from "angular";
import {timApp} from "tim/app";
import * as formErrorMessage from "tim/directives/formErrorMessage";
import * as shortNameValidator from "tim/directives/shortNameValidator";
import {markAsUsed} from "tim/utils";
import {$http, $window} from "../ngimport";
import {slugify} from "../services/slugify";

markAsUsed(formErrorMessage, shortNameValidator);

class CreateItemController implements IController {
    private fullPath: string;
    private automaticShortName: boolean;
    private itemLocation: string | undefined;
    private itemTitle: string | undefined;
    private itemName: string | undefined;
    private alerts: {}[];
    private itemType: string;
    private params: {template?: string};
    private force: boolean;
    private creating: boolean;
    private template: string;

    constructor() {
        this.automaticShortName = !this.force;

        if (this.fullPath) {
            const str = this.fullPath;
            this.itemLocation = str.substring(0, str.lastIndexOf("/"));
            this.itemTitle = str.substring(str.lastIndexOf("/") + 1, str.length);
        }
        if (this.itemTitle) {
            this.itemName = slugify(this.itemTitle);
        }
        if (this.template) {
            this.params = this.params || {};
            this.params.template = this.template;
        }

        this.alerts = [];
    }

    $onInit() {

    }

    createItem() {
        this.creating = true;
        $http.post<{path: string}>("/createItem", angular.extend({
            item_path: this.itemLocation + "/" + this.itemName,
            item_type: this.itemType,
            item_title: this.itemTitle,
        }, this.params)).then((response) => {
            $window.location.href = "/view/" + response.data.path;
        }, (response) => {
            this.alerts = [];
            this.alerts.push({msg: response.data.error, type: "danger"});
            this.creating = false;
        });
    }

    closeAlert(index: number) {
        this.alerts.splice(index, 1);
    }

    titleChanged() {
        if (!this.automaticShortName) {
            return;
        }
        if (this.itemTitle != null) {
            this.itemName = slugify(this.itemTitle);
        }
    }

    nameChanged() {
        this.automaticShortName = (this.itemName || []).length === 0;
    }
}

timApp.component("createItem", {
    bindings: {
        itemType: "@", // folder or document
        itemTitle: "@?",
        itemName: "@?",
        itemLocation: "@?",
        fullPath: "@?",
        params: "=?", // any additional parameters to be sent to server
        force: "=?",
        template: "@?",
    },
    controller: CreateItemController,
    templateUrl: "/static/templates/createItem.html",
});
