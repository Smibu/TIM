import {IPromise} from "angular";
import moment from "moment";
import {ngStorage} from "ngstorage";
import {DialogController, registerDialogComponent, showDialog} from "../ui/dialog";
import {$http, $httpParamSerializer, $localStorage} from "../util/ngimport";
import {to} from "../util/utils";
import {IExportOptions} from "./userlistController";
import {IUser} from "../user/IUser";

interface IFBOptions {
    period: any;
    valid: string;
    name: string;
    periodFrom: any;
    periodTo: any;
    scope: string;
    answers: string;
    format: string;
    users: string;
    decimal: string;
}

export interface IFeedbackAnswersParams {
    identifier: string;
    users: IUser[];
    url: string;
    allTasks: boolean;
}

export class FeedbackAnswersCtrl extends DialogController<{params: IFeedbackAnswersParams}, {}> {
    static component = "timFeedbackAnswers";
    static $inject = ["$element", "$scope"] as const;
    private options!: IFBOptions; // $onInit
    private $storage!: ngStorage.StorageService & {feedbackAnswersOptions: IFBOptions}; // $onInit
    private showSort: boolean = false;
    private datePickerOptionsFrom!: EonasdanBootstrapDatetimepicker.SetOptions; // $onInit
    private datePickerOptionsTo!: EonasdanBootstrapDatetimepicker.SetOptions; // $onInit
    private lastFetch: any;

    protected getTitle() {
        return "Export to csv";
    }

    async $onInit() {
        super.$onInit();
        const options = this.resolve.params;
        moment.locale("en", {
            week: {dow: 1, doy: 4}, // This sets Monday as the first day of the week.
        });
        this.showSort = options.allTasks;
        this.options = {
            period: "whenever",
            valid: "1",
            name: "both",
            periodFrom: null,
            periodTo: null,
            scope: "task",
            answers: "all",
            format: "semicolon",
            users: "",
            decimal: "point",
        };
        this.$storage = $localStorage.$default({
            feedbackAnswersOptions: this.options,
        });

        this.options = this.$storage.feedbackAnswersOptions;
        this.options.periodFrom = this.options.periodFrom || Date.now();
        this.options.periodTo = this.options.periodTo || Date.now();
        this.datePickerOptionsFrom = {
            format: "D.M.YYYY HH:mm:ss",
            defaultDate: moment(this.options.periodFrom),
            showTodayButton: true,
        };
        this.datePickerOptionsTo = {
            format: "D.M.YYYY HH:mm:ss",
            defaultDate: moment(this.options.periodTo),
            showTodayButton: true,
        };

        this.lastFetch = null;
        const r =
            await to($http.get<{last_answer_fetch: {[index: string]: string}}>("/settings/get/last_answer_fetch"));
        if (r.ok && r.result.data.last_answer_fetch) {
            this.lastFetch = r.result.data.last_answer_fetch[options.identifier];
            if (!this.lastFetch) {
                this.lastFetch = "no fetches yet";
            }
        }
        this.options.users = "";
        for (const user of options.users)
        {
            this.options.users += user.name + ",";
        }
    }

    ok() {
        if (this.options.periodFrom) {
            this.options.periodFrom = this.options.periodFrom.toDate();
        }
        if (this.options.periodTo) {
            this.options.periodTo = this.options.periodTo.toDate();
        }
        window.open(this.resolve.params.url + "?" + $httpParamSerializer(this.options), "_blank");
        this.close({});
    }
    cancel() {
        this.dismiss();
    }
}

registerDialogComponent(FeedbackAnswersCtrl,
    {templateUrl: "/static/templates/allFeedbackAnswersOptions.html"});

export function showFeedbackAnswers(p: IFeedbackAnswersParams): IPromise<FeedbackAnswersCtrl["ret"]> {
    return showDialog(FeedbackAnswersCtrl, {params: () => p}).result;
}
