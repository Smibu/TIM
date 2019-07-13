import {IController, IRootElementService, IScope, ITranscludeFunction} from "angular";
import * as allanswersctrl from "tim/answer/allAnswersController";
import {timApp} from "tim/app";
import {timLogTime} from "tim/util/timTiming";
import {dereferencePar, getParId} from "../document/parhelpers";
import {ViewCtrl} from "../document/viewctrl";
import {compileWithViewctrl, ParCompiler} from "../editor/parCompiler";
import {DestroyScope} from "../ui/destroyScope";
import {showMessageDialog} from "../ui/dialog";
import {IUser} from "../user/IUser";
import {Users} from "../user/userService";
import {KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_UP} from "../util/keycodes";
import {$filter, $http, $httpParamSerializer, $q, $timeout, $window} from "../util/ngimport";
import {Binding, getURLParameter, markAsUsed, Require, to} from "../util/utils";
import {showAllAnswers} from "./allAnswersController";
import {IAnswer} from "./IAnswer";

markAsUsed(allanswersctrl);

timLogTime("answerbrowser3 load", "answ");

const LAZY_MARKER = "lazy";
const LAZY_MARKER_LENGTH = LAZY_MARKER.length;
const FIELD_PLUGINS = new Set(["textfield", "numericfield"]);

function isElement(n: Node): n is Element {
    return n.nodeType === Node.ELEMENT_NODE;
}

async function loadPlugin(html: string, plugin: JQuery, scope: IScope, viewctrl: ViewCtrl) {
    const elementToCompile = $(html);
    elementToCompile.attr("plugintype", plugin.attr("data-plugin") || null);
    elementToCompile.attr("taskid", plugin.attr("id") || null);
    const compiled = compileWithViewctrl(elementToCompile, scope, viewctrl);
    await $timeout(); // let AngularJS finish its processing
    await ParCompiler.processAllMath(compiled);
    plugin.empty().append(compiled);
    plugin.css("opacity", "1.0");
}

export class PluginLoaderCtrl extends DestroyScope implements IController {
    static $inject = ["$element", "$scope", "$transclude"];
    private compiled = false;
    private viewctrl?: Require<ViewCtrl>;
    public taskId!: Binding<string, "@">;
    private type!: Binding<string, "@">;
    private showBrowser: boolean = false;
    private pluginElement?: JQuery;
    public showPlaceholder = true;
    public abLoad = $q.defer<AnswerBrowserController | null>();

    constructor(private element: IRootElementService, private scope: IScope, private transclude: ITranscludeFunction) {
        super(scope, element);
        transclude((clone, s) => {
            const c = clone!.filter("[data-plugin]");
            this.pluginElement = c;
            element.append(c);
        });
        timLogTime("timPluginLoader constructor", "answ", 1);
    }

    $onInit() {
        if (this.viewctrl) {
            this.viewctrl.registerPluginLoader(this);
        }
        if (this.isValidTaskId(this.taskId)) {
            const [id, name] = this.taskId.split(".");
            if (getURLParameter("task") === name) {
                this.loadPlugin();
            }
        }
        this.showPlaceholder = !this.isInFormMode();
    }

    $postLink() {
        this.element.on("mouseenter touchstart", this.loadPlugin);
    }

    $onDestroy() {
        this.removeActivationHandler();
    }

    private removeActivationHandler() {
        this.element.off("mouseenter touchstart", this.loadPlugin);
    }

    /**
     * Returns whether the given task id is valid.
     * A valid task id is of the form '1.taskname'.
     * @param taskId {string} The task id to validate.
     * @returns {boolean} True if the task id is valid, false otherwise.
     */
    isValidTaskId(taskId: string) {
        return taskId && taskId.slice(-1) !== "."; // TODO should check more accurately
    }

    loadPlugin = () => {
        if (this.compiled) {
            return;
        }
        this.scope.$evalAsync(async () => {
            const plugin = this.getPluginElement();
            this.compiled = true;
            if (this.viewctrl && !this.viewctrl.noBrowser && this.isValidTaskId(this.taskId) && this.type !== "lazyonly" && Users.isLoggedIn()) {
                this.showBrowser = true;
            } else {
                this.abLoad.resolve(null); // this plugin instance doesn't have answer browser
            }
            const h = this.getNonLazyHtml();
            if (h && this.viewctrl) {
                await loadPlugin(h, plugin, this.viewctrl.scope, this.viewctrl);
            }
            this.removeActivationHandler();
        });
    }

    /**
     * Returns the non-lazy HTML for the plugin if the plugin is lazy.
     * If the plugin is not lazy, returns nothing.
     */
    getNonLazyHtml() {
        const pe = this.getPluginElement();
        const cns = pe[0].childNodes;
        let nonLazyHtml;
        for (const n of cns) {
            if (n.nodeType === Node.COMMENT_NODE &&
                n.nodeValue &&
                n.nodeValue.startsWith(LAZY_MARKER) &&
                n.nodeValue.endsWith(LAZY_MARKER)) {
                nonLazyHtml = n.nodeValue.slice(LAZY_MARKER_LENGTH, n.nodeValue.length - LAZY_MARKER_LENGTH);
                break;
            } else if (isElement(n) && n.tagName === "DIV" && n.className === LAZY_MARKER) {
                nonLazyHtml = n.getAttribute("data-html");
                break;
            }
        }
        return nonLazyHtml;
    }

    getPluginElement(): JQuery {
        return this.element.find("[data-plugin]");
    }

    unDimPlugin() {
        this.getPluginElement().css("opacity", "1");
    }

    dimPlugin() {
        if (!this.isInFormMode()) {
            this.getPluginElement().css("opacity", "0.3");
        }
    }

    isPreview() {
        return this.element.parents(".previewcontent").length > 0;
    }

    isInFormMode() {
        if (!this.viewctrl) {
            return false;
        }
        return this.viewctrl.docSettings.form_mode && this.isFieldPlugin();
    }

    isFieldPlugin() {
        const plugin = this.getPluginElement().attr("data-plugin");
        if (!plugin) {
            return false;
        }
        return FIELD_PLUGINS.has(plugin.slice(1)); // remove leading '/' so we get only the plugin type name
    }
}

timApp.component("timPluginLoader", {
    bindings: {
        answerId: "<?",
        taskId: "@",
        type: "@",
    },
    controller: PluginLoaderCtrl,
    require: {
        viewctrl: "?^timView",
    },
    template: `
<div class="answerBrowserPlaceholder" ng-if="$ctrl.answerId && $ctrl.showPlaceholder && !$ctrl.isPreview()" style="width: 1px; height: 23px;"></div>
<answerbrowser ng-class="{'has-answers': $ctrl.answerId}"
               ng-if="$ctrl.showBrowser && !$ctrl.isPreview()"
               task-id="$ctrl.taskId"
               answer-id="$ctrl.answerId">
</answerbrowser>
    `,
    transclude: true,
});

export interface ITaskInfo {
    userMin: number;
    userMax: number;
    answerLimit: number;
}

export interface IAnswerSaveEvent {
    savedNew: number | false;
    error?: string;
}

type AnswerCallback = (a: IAnswer) => void;

export class AnswerBrowserController extends DestroyScope implements IController {
    static $inject = ["$scope", "$element"];
    public taskId!: Binding<string, "<">;
    private loading: number;
    private viewctrl!: Require<ViewCtrl>;
    private user: IUser | undefined;
    private fetchedUser: number = 0; // IUser | undefined;
    private saveTeacher: boolean = false;
    private users: IUser[] | undefined;
    private answers: IAnswer[] = [];
    private filteredAnswers: IAnswer[] = [];
    private onlyValid: boolean = true;
    public selectedAnswer: IAnswer | undefined;
    private anyInvalid: boolean = false;
    private giveCustomPoints: boolean = false;
    public review: boolean = false;
    private shouldFocus: boolean = false;
    private alerts: Array<{}> = [];
    private taskInfo: ITaskInfo | undefined;
    private points: number | undefined;
    private loadedAnswer: { id: number | undefined, review: boolean } = {review: false, id: undefined};
    private answerId?: Binding<number, "<?">;
    private loader!: PluginLoaderCtrl;
    private reviewHtml?: string;
    private answerListener?: AnswerCallback;

    constructor(private scope: IScope, private element: IRootElementService) {
        super(scope, element);
        this.loading = 0;
    }

    registerNewAnswer(args: IAnswerSaveEvent) {
        if (args.savedNew) {
            this.loadedAnswer.id = args.savedNew;
            this.review = false;
            this.loadedAnswer.review = false;
            this.getAnswersAndUpdate();
            // HACK: for some reason the math mode is lost because of the above call, so we restore it here
            ParCompiler.processAllMathDelayed(this.loader.getPluginElement());
        }
        if (args.error) {
            this.alerts.push({msg: args.error, type: "warning"});
        }
    }

    async $onInit() {
        if (this.loader.isInFormMode()) {
            this.element.hide();
        }
        this.viewctrl.registerAnswerBrowser(this);
        this.scope.$watch(() => this.taskId, (newValue, oldValue) => {
            if (newValue === oldValue) {
                return;
            }
            if (this.viewctrl.teacherMode) {
                this.getAvailableUsers();
            }
            this.getAnswersAndUpdate();
        });

        if (this.viewctrl.teacherMode) {
            // ng-keypress will not fire if the textbox has focus
            this.element[0].addEventListener("keydown", this.checkKeyPress);
        }

        if (this.viewctrl.selectedUser) {
            this.user = this.viewctrl.selectedUser;
        } else if (this.viewctrl.users && this.viewctrl.users.length > 0) {
            this.user = this.viewctrl.users[0];
        } else {
            this.user = Users.getCurrent();
        }
        this.loadedAnswer.id = this.getPluginHtmlAnswerId();

        // TODO: This condition is inaccurate because we don't really know who the initially loaded user is.
        if (this.viewctrl.users.length > 0 && this.user !== this.viewctrl.users[0]) {
            this.dimPlugin();
        }
        this.saveTeacher = false;
        this.users = undefined;
        this.answers = [];
        this.filteredAnswers = [];
        this.onlyValid = true;
        this.anyInvalid = false;
        this.giveCustomPoints = false;
        this.review = false;
        this.shouldFocus = false;
        this.alerts = [];

        this.scope.$watch(() => this.review, () => this.changeAnswer());
        this.scope.$watchGroup([
            () => this.onlyValid,
        ], (newValues, oldValues, scope) => this.updateFilteredAndSetNewest());

        // form_mode off or plugin ab didn't register as form (doesn't support setAnswer?)
        // else answers, taskinfo (and maybe users) are given by viewctrl
        if (!this.viewctrl.docSettings.form_mode || !this.viewctrl.getFormAnswerBrowser(this.taskId)) {
            const answs = await this.getAnswers();
            if (answs && (answs.length > 0)) {
                this.answers = answs;
                const updated = this.updateAnswerFromURL();
                if (!updated) {
                    this.handleAnswerFetch(this.answers);
                }
            }
            await this.loadInfo();
            await this.checkUsers(); // load users, answers have already been loaded for the currently selected user

            this.loader.getPluginElement().on("mouseenter touchstart", () => {
                void this.checkUsers();
            });
        }

        // TODO: Angular throws error if many answerbrowsers resolve around the same time
        //  (e.g awaits above don't happen if were in form mode and don't want separate info reqs)
        await $timeout(0);
        this.loader.abLoad.resolve(this);
    }

    async changeUser(user: IUser, updateAll: boolean) {
        this.user = user;
        if (updateAll) {
            await this.loadUserAnswersIfChanged();
        } else if (this.hasUserChanged()) {
            this.dimPlugin();
        } else {
            this.unDimPlugin();
        }
    }

    async changeUserAndAnswers(user: IUser, answers: IAnswer[]) {
        // let needsAnswerChange = false;
        this.user = user;
        this.fetchedUser = this.user ? this.user.id : 0;
        this.answers = answers;
        this.updateFiltered();
        this.selectedAnswer = this.filteredAnswers.length > 0 ? this.filteredAnswers[0] : undefined;
        // console.log("debug line");
        await this.loadInfo();
    }

    changeAnswerFromState(html: string, reviewHtml: string) {
        if (this.selectedAnswer == null || !this.user) {
            return;
        }
        this.unDimPlugin();
        this.updatePoints();
        const par = this.element.parents(".par");
        const ids = dereferencePar(par);
        if (!ids) {
            return;
        }
        if (this.selectedAnswer.id !== this.loadedAnswer.id || this.loadedAnswer.review !== this.review) {

            this.loadedAnswer.id = this.selectedAnswer.id;
            this.loadedAnswer.review = this.review;
            if (this.answerListener) {
                this.answerListener(this.selectedAnswer);
            } else {
                void loadPlugin(html, this.loader.getPluginElement(), this.scope, this.viewctrl);
            }
            // if (this.review) { //No review implemented for this version yet
            //     this.reviewHtml = r.result.data.reviewHtml;
            //     await $timeout();
            // }
        }
        this.viewctrl.reviewCtrl.loadAnnotationsToAnswer(this.selectedAnswer.id, par[0], this.review);

    }

    private unDimPlugin() {
        this.loader.unDimPlugin();
    }

    urlParamMatchesThisTask() {
        return getURLParameter("task") === this.getTaskName();
    }

    async $postLink() {
        this.loader.showPlaceholder = false;
        if (this.urlParamMatchesThisTask()) {
            await $timeout(0);
            this.element[0].scrollIntoView();
        }
    }

    async savePoints() {
        if (!this.selectedAnswer || !this.user) {
            return;
        }
        const r = await to($http.put("/savePoints/" + this.user.id + "/" + this.selectedAnswer.id,
            {points: this.points}));
        this.shouldFocus = true;
        if (!r.ok) {
            this.showError(r.result);
            return;
        }
        if (!this.selectedAnswer) {
            return;
        }
        this.selectedAnswer.points = this.points;
    }

    updatePoints() {
        if (!this.selectedAnswer) {
            return;
        }
        this.points = this.selectedAnswer.points;
        if (this.points != null) {
            this.giveCustomPoints = this.selectedAnswer.last_points_modifier != null;
        } else {
            this.giveCustomPoints = false;
        }
    }

    setFocus() {
        this.element.focus();
    }

    registerAnswerListener(ac: AnswerCallback) {
        this.answerListener = ac;
    }

    async changeAnswer() {
        if (this.selectedAnswer == null || !this.user) {
            return;
        }
        this.unDimPlugin();
        this.updatePoints();
        const par = this.element.parents(".par");
        const ids = dereferencePar(par);
        if (!ids) {
            return;
        }
        const parParams = {
            doc_id: ids[0],
            par_id: ids[1],
            ref_from_doc_id: this.viewctrl.docId,
            ref_from_par_id: getParId(par),
        };
        if (this.selectedAnswer.id !== this.loadedAnswer.id || this.loadedAnswer.review !== this.review) {
            this.loading++;
            const r = await to($http.get<{ html: string, reviewHtml: string }>("/getState", {
                params: {
                    ...parParams,
                    answer_id: this.selectedAnswer.id,
                    review: this.review,
                    user_id: this.user.id,
                },
            }));
            this.loading--;
            if (!r.ok) {
                this.showError(r.result);
                return;
            }
            this.loadedAnswer.id = this.selectedAnswer.id;
            this.loadedAnswer.review = this.review;
            if (this.answerListener) {
                this.answerListener(this.selectedAnswer);
            } else {
                void loadPlugin(r.result.data.html, this.loader.getPluginElement(), this.scope, this.viewctrl);
            }
            if (this.review) {
                this.reviewHtml = r.result.data.reviewHtml;
                await $timeout();
            }
        }
        this.viewctrl.reviewCtrl.loadAnnotationsToAnswer(this.selectedAnswer.id, par[0], this.review);
    }

    // TODO: as in changeAnswer() until the request part
    stateRequestPrep() {
        if (this.selectedAnswer == null || !this.user) {
            return;
        }
        this.unDimPlugin();
        this.updatePoints();
        const par = this.element.parents(".par");
        const ids = dereferencePar(par);
        if (!ids) {
            return;
        }
        const parParams = {
            doc_id: ids[0],
            par_id: ids[1],
            ref_from_doc_id: this.viewctrl.docId,
            ref_from_par_id: getParId(par),
        };
        const params = {
            ...parParams,
            answer_id: this.selectedAnswer.id,
            review: this.review,
            user_id: this.user.id,
        };
        return params;
    }

    async continueFromStateReq(html: string, reviewHtml: string) {
        if (this.selectedAnswer == null) { return; }
        const par = this.element.parents(".par");
        const ids = dereferencePar(par);
        if (!ids) {
            return;
        }
        this.loadedAnswer.id = this.selectedAnswer.id;
        this.loadedAnswer.review = this.review;
        if (this.answerListener) {
            this.answerListener(this.selectedAnswer);
        } else {
            void loadPlugin(html, this.loader.getPluginElement(), this.scope, this.viewctrl);
        }
        if (this.review) {
            this.reviewHtml = reviewHtml;
            await $timeout();
        }

        this.viewctrl.reviewCtrl.loadAnnotationsToAnswer(this.selectedAnswer.id, par[0], this.review);
    }

    nextAnswer() {
        let newIndex = this.findSelectedAnswerIndex() - 1;
        if (newIndex < 0) {
            newIndex = this.filteredAnswers.length - 1;
        }
        this.selectedAnswer = this.filteredAnswers[newIndex];
        this.changeAnswer();
    }

    previousAnswer() {
        let newIndex = this.findSelectedAnswerIndex() + 1;
        if (newIndex >= this.filteredAnswers.length) {
            newIndex = 0;
        }
        this.selectedAnswer = this.filteredAnswers[newIndex];
        this.changeAnswer();
    }

    findSelectedUserIndex() {
        if (!this.users || !this.user) {
            return -1;
        }
        for (let i = 0; i < this.users.length; i++) {
            if (this.users[i].id === this.user.id) {
                return i;
            }
        }
        return -1;
    }

    checkKeyPress = (e: KeyboardEvent) => {
        if (this.loading > 0) {
            return;
        }
        if (e.ctrlKey) {
            // e.key does not work on IE but it is more readable, so let's use both
            if ((e.key === "ArrowUp" || e.which === KEY_UP)) {
                e.preventDefault();
                this.changeStudent(-1);
            } else if ((e.key === "ArrowDown" || e.which === KEY_DOWN)) {
                e.preventDefault();
                this.changeStudent(1);
            } else if ((e.key === "ArrowLeft" || e.which === KEY_LEFT)) {
                e.preventDefault();
                this.previousAnswer();
            } else if ((e.key === "ArrowRight" || e.which === KEY_RIGHT)) {
                e.preventDefault();
                this.nextAnswer();
            }
        }
    }

    changeStudentToIndex(newIndex: number) {
        if (!this.users) {
            return;
        }
        if (this.users.length <= 0) {
            return;
        }
        const shouldRefocusPoints = this.shouldFocus;
        if (newIndex >= this.users.length) {
            newIndex = 0;
        }
        if (newIndex < 0) {
            newIndex = this.users.length - 1;
        }
        if (newIndex < 0) {
            return;
        }
        this.user = this.users[newIndex];
        this.getAnswersAndUpdate();

        // Be careful when modifying the following code. All browsers (IE/Chrome/FF)
        // behave slightly differently when it comes to (de-)focusing something.
        $timeout(() => {
            if (shouldRefocusPoints) {
                this.shouldFocus = shouldRefocusPoints;
            } else {
                this.setFocus();
            }
        }, 200);
    }

    changeStudent(dir: 1 | -1) {
        const newIndex = this.findSelectedUserIndex() + dir;
        this.changeStudentToIndex(newIndex);
    }

    randomStudent() {
        if (!this.users) {
            return;
        }
        const newIndex = Math.floor(Math.random() * this.users.length);
        this.changeStudentToIndex(newIndex);
    }

    setNewest() {
        if (this.filteredAnswers.length > 0) {
            this.selectedAnswer = this.filteredAnswers[0];
            this.changeAnswer();
        }
    }

    setAnswerById(id: number, updateImmediately: boolean) {
        for (const f of this.filteredAnswers) {
            if (f.id === id) {
                this.selectedAnswer = f;
                if (updateImmediately) {
                    this.changeAnswer();
                }
                break;
            }
        }
    }

    getBrowserData() {
        const common = {
            teacher: this.viewctrl.teacherMode,
            saveAnswer: !this.viewctrl.noBrowser,
        };
        if (this.user) {
            return {
                answer_id: this.selectedAnswer ? this.selectedAnswer.id : undefined,
                saveTeacher: this.saveTeacher || (this.loader.isInFormMode() && this.viewctrl.teacherMode), // TODO: Check if correct
                points: this.points,
                giveCustomPoints: this.giveCustomPoints,
                userId: this.user.id,
                ...common,
            };
        } else {
            return {
                saveTeacher: false,
                ...common,
            };
        }
    }

    async getAvailableUsers() {
        this.loading++;
        const r = await to($http.get<IUser[]>("/getTaskUsers/" + this.taskId, {params: {group: this.viewctrl.group}}));
        this.loading--;
        if (!r.ok) {
            this.showError(r.result);
            return;
        }
        this.users = r.result.data;
    }

    showError(response: { data: { error: string } }) {
        this.alerts.push({msg: "Error: " + response.data.error, type: "danger"});
    }

    getAnswerLink() {
        if (!this.user || !this.selectedAnswer) {
            return undefined;
        }
        return `/answers/${this.viewctrl.item.path}?${$httpParamSerializer({
            answerNumber: this.answers.length - this.findSelectedAnswerIndexFromUnFiltered(),
            task: this.getTaskName(),
            user: this.user.name,
        })}`;
    }

    updateAnswerFromURL() {
        const answerNumber = getURLParameter("answerNumber");
        const index = this.answers.length - parseInt(answerNumber || "1", 10);
        if (answerNumber != null && this.urlParamMatchesThisTask()) {
            if (index >= 0 && index < this.answers.length) {
                this.onlyValid = false;
                this.updateFiltered();
                this.selectedAnswer = this.filteredAnswers.length > 0 ? this.filteredAnswers[index] : undefined;
                this.changeAnswer();
                return true;
            } else {
                void showMessageDialog(`Answer number ${answerNumber} is out of range for this task and user.`);
            }
        }
        return false;
    }

    async getAnswersAndUpdate() {
        // if ( this.isUseCurrentUser(this.taskId) ) { return null; }

        if (!this.viewctrl.item.rights || !this.viewctrl.item.rights.browse_own_answers) {
            return;
        }
        const data = await this.getAnswers();
        if (!data || data.length === 0) {
            if ( data != null ) {
                this.loadedAnswer = {review: false, id: undefined};
                this.resetITimComponent();
            }
        }
        if (!data) {
            return;
        }
        this.handleAnswerFetch(data);
        return data;
    }

    private handleAnswerFetch(data: IAnswer[]) {
        if (data.length > 0 && (this.hasUserChanged() || data.length !== this.answers.length)) {
            this.answers = data;
            this.updateFiltered();
            this.selectedAnswer = this.filteredAnswers.length > 0 ? this.filteredAnswers[0] : undefined;
            if (!this.selectedAnswer) {
                this.dimPlugin();
            } else {
                this.changeAnswer();
            }
        } else {
            this.answers = data;
            if (this.answers.length === 0 && this.viewctrl.teacherMode) {
                this.dimPlugin();
            }
            this.updateFilteredAndSetNewest();
        }
    }

    private isUseCurrentUser(taskId: string) {
        let uid = 0;
        if ( this.user ) { uid = this.user.id; }
        const c: any = this.viewctrl.getTimComponentByName(this.taskId.split(".")[1]);
        if ( !c ) { return uid; }
        const a: any = c.attrsall;
        if ( a && a.markup && a.markup.useCurrentUser ) {
            const w: any = window;
            this.user = w.current_user;
            return w.current_user.id;
        }
        return uid;
    }

    /* Return user answers, null = do not care */
    private async getAnswers() {
        const uid = this.isUseCurrentUser(this.taskId);
        if (!uid) {
            return undefined;
        }
        this.loading++;
        const r = await to($http.get<IAnswer[]>(`/answers/${this.taskId}/${uid}`, {
            params: {
                _: Date.now(),
            },
        }));
        this.loading--;
        if (!r.ok) {
            this.showError(r.result);
            return undefined;
        }
        this.fetchedUser = uid;
        return r.result.data;
    }

    getPluginHtmlAnswerId() {
        return this.answerId;
    }

    hasUserChanged() {
        return (this.user || {id: null}).id !== this.fetchedUser;
    }

    dimPlugin() {
        this.loader.dimPlugin();
    }

    allowCustomPoints() {
        if (this.taskInfo == null) {
            return false;
        }
        return this.taskInfo.userMin != null && this.taskInfo.userMax != null;
    }

    resetITimComponent() {
        const c = this.viewctrl.getTimComponentByName(this.taskId.split(".")[1]);
        if (c) {
            c.resetField();
        }
    }

    async loadUserAnswersIfChanged() {
        if (this.hasUserChanged()) {
            const answers = await this.getAnswersAndUpdate();
            // if (!answers || answers.length === 0) {
            //     // if ( answers != null ) { this.resetITimComponent(); }
            // } else {
            //     // this.loadedAnswer = {review: false, id: undefined};
            //     // this.changeAnswer();
            // }
            await this.loadInfo();
        }
    }

    showTeacher() {
        return this.viewctrl.teacherMode && this.viewctrl.item.rights.teacher;
    }

    showVelpsCheckBox() {
        // return this.$parent.teacherMode || $window.velpMode; // && this.$parent.item.rights.teacher;
        return $window.velpMode || this.element.parents(".par").hasClass("has-annotation");
    }

    getTriesLeft() {
        if (this.taskInfo == null) {
            return null;
        }
        return Math.max(this.taskInfo.answerLimit - this.answers.length, 0);
    }

    public setInfo(info: ITaskInfo) {
        this.taskInfo = info;
    }

    async loadInfo() {
        if (this.taskInfo != null) {
            return;
        }
        this.loading++;
        const r = await to($http.get<ITaskInfo>("/taskinfo/" + this.taskId));
        this.loading--;
        if (!r.ok) {
            this.showError(r.result);
            return;
        }
        this.taskInfo = r.result.data;
    }

    async checkUsers() {
        if (this.loading > 0) {
            return;
        }
        await this.loadUserAnswersIfChanged();
        if (this.viewctrl.teacherMode && this.users == null) {
            this.users = [];
            if (this.viewctrl.users.length > 0) {
                await this.getAvailableUsers();
            }
        }
    }

    async getAllAnswers() {
        await showAllAnswers({
            url: "/allAnswersPlain/" + this.taskId,
            identifier: this.taskId,
            allTasks: false,
        });
    }

    findSelectedAnswerIndex() {
        if (this.filteredAnswers == null || this.selectedAnswer == null) {
            return -1;
        }
        for (let i = 0; i < this.filteredAnswers.length; i++) {
            if (this.filteredAnswers[i].id === this.selectedAnswer.id) {
                return i;
            }
        }
        return -1;
    }

    private findSelectedAnswerIndexFromUnFiltered() {
        if (this.selectedAnswer == null) {
            return -1;
        }
        for (let i = 0; i < this.answers.length; i++) {
            if (this.answers[i].id === this.selectedAnswer.id) {
                return i;
            }
        }
        return -1;
    }

    updateFiltered() {
        this.anyInvalid = false;
        this.filteredAnswers = $filter("filter")<IAnswer>(this.answers, (value, index, array) => {
            if (value.valid) {
                return true;
            }
            this.anyInvalid = true;
            return !this.onlyValid;
        });
    }

    updateFilteredAndSetNewest() {
        this.updateFiltered();
        if (this.findSelectedAnswerIndex() < 0) {
            this.setNewest();
        }
    }

    closeAlert(index: number) {
        this.alerts.splice(index, 1);
    }

    $onDestroy() {
        this.element[0].removeEventListener("keydown", this.checkKeyPress);
    }

    private getTaskName() {
        const [id, name] = this.taskId.split(".");
        return name;
    }
}

timApp.component("answerbrowser", {
    bindings: {
        answerId: "<?",
        taskId: "<",
    },
    controller: AnswerBrowserController,
    require: {
        loader: "^timPluginLoader",

        // This is not a real component but a workaround for getting reference to the correct paragraph.
        // Answerbrowser gets compiled before being attached to DOM to avoid too early rendering,
        // so we can't use "this.element.parents()" to look for parent elements, so instead, we pass
        // the paragraph to the compile call.
        // par: "^timPar",

        viewctrl: "^timView",
    },
    templateUrl: "/static/templates/answerBrowser.html",
});
