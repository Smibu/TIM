import {IController, IHttpResponse, IPromise} from "angular";
import {timApp} from "tim/app";
import * as loading from "tim/ui/loadingIndicator";
import * as onEnter from "tim/ui/onEnter";
import {$http} from "../util/ngimport";
import {capitalizeFirstLetter, markAsUsed, to, ToReturn} from "../util/utils";
import {IUser} from "./IUser";
import {Users} from "./userService";

markAsUsed(onEnter, loading);

interface IOkResponse {
    status: "ok";
}

interface INameResponse {
    status: "name";
    name: string;
    can_change_name: boolean;
}

class LoginMenuController implements IController {
    private loggingout: boolean;
    private form: {email: string, password: string};
    private addingToSession: boolean;
    private korppiLoading: boolean = false;
    private emailSent = false;
    private showSignup = false;
    private focusEmail = false;
    private focusPassword = false;
    private tempPasswordProvided = false;
    private nameProvided = false;
    private focusName = false;
    private focusLink = false;
    private wrongPassword = false;
    private email: string | undefined;
    private tempPassword: string | undefined;
    private name: string | undefined;
    private signUpError: string | undefined;
    private signUpRequestInProgress = false;
    private newPassword: string | undefined;
    private rePassword: string | undefined;
    private finishStatus: undefined | "registered" | "updated";
    private resetPassword = false;
    private canChangeName = true;
    private focusNewPassword = false;
    private loginError: string | undefined;

    constructor() {
        this.form = {email: "", password: ""};
        this.loggingout = false;
        this.addingToSession = false;
    }

    $onInit() {

    }

    getCurrentUser = () => Users.getCurrent();
    getSessionUsers = () => Users.getSessionUsers();

    addUser($event: Event) {
        $event.stopPropagation();
        this.addingToSession = !this.addingToSession;
    }

    logout = (user: IUser, logoutFromKorppi = false) => Users.logout(user, logoutFromKorppi);
    isLoggedIn = () => Users.isLoggedIn();

    korppiLogin(addingToSession: boolean) {
        this.korppiLoading = true;
        Users.korppiLogin(addingToSession);
    }

    isKorppi = () => Users.isKorppi();

    stopClick($event: Event) {
        $event.stopPropagation();
    }

    toggled(open: boolean) {
        if (!open) {
            this.addingToSession = false;
        }
    }

    async loginWithEmail() {
        const [err, resp] = await Users.loginWithEmail(this.form.email, this.form.password, this.addingToSession);
        if (err) {
            this.loginError = err.data.error;
        } else {
            this.loginError = undefined;
            if (!this.addingToSession) {
                window.location.reload();
            }
        }
    }

    beginLogout($event: Event) {
        if (Users.isKorppi()) {
            this.loggingout = true;
            $event.stopPropagation();
        } else {
            this.logout(this.getCurrentUser());
        }
    }

    private async provideEmail() {
        if (!this.email || this.signUpRequestInProgress) {
            return;
        }
        const [err, resp] = await this.sendRequest("/altsignup", {
            email: this.email,
        });
        if (err) {
            this.signUpError = err.data.error;
        } else if (resp) {
            this.signUpError = undefined;
            this.emailSent = true;
            this.focusPassword = true;
        }
    }

    private async sendRequest<T>(url: string, data: any): ToReturn<T> {
        this.signUpRequestInProgress = true;
        const [err, resp] = await to($http.post<T>(url, data));
        this.signUpRequestInProgress = false;
        if (err && !resp) {
            return [err, resp];
        } else if (!err && resp) {
            return [err, resp];
        } else {
            throw new Error("unreachable");
        }
    }

    private beginSignup() {
        this.showSignup = true;
        this.focusEmail = true;
        if (this.form.email) {
            this.email = this.form.email;
        }
    }

    private async provideTempPassword() {
        if (!this.email || !this.tempPassword || this.signUpRequestInProgress) {
            return;
        }
        const [err, resp] = await this.sendRequest<IOkResponse | INameResponse>("/checkTempPass", {
            email: this.email,
            token: this.tempPassword,
        });
        if (err) {
            this.signUpError = err.data.error;
        } else if (resp) {
            this.signUpError = undefined;
            this.tempPasswordProvided = true;
            this.focusName = true;
            if (resp.data.status === "name") {
                this.name = resp.data.name;
                this.canChangeName = resp.data.can_change_name;
                if (!this.canChangeName) {
                    this.focusName = false;
                    this.focusNewPassword = true;
                }
            } else {
                const nameParts = this.email.split("@")[0].split(".");
                for (const n of nameParts) {
                    // don't try to form name if there are any special characters
                    if (n.match(/[^a-zöäåé]/i)) {
                        return;
                    }
                }
                const lastName = capitalizeFirstLetter(nameParts[nameParts.length - 1]);
                let firstName = "";
                if (nameParts.length > 1) {
                    firstName = capitalizeFirstLetter(nameParts[0]);
                }
                this.name = `${lastName} ${firstName}`.trim();
            }
        }
    }

    private async provideName() {
        if (!this.name || this.signUpRequestInProgress) {
            return;
        }
        const [err, resp] = await this.sendRequest<{status: "registered" | "updated"}>("/altsignup2", {
            email: this.email,
            passconfirm: this.rePassword,
            password: this.newPassword,
            realname: this.name,
            token: this.tempPassword,
        });
        if (err) {
            this.signUpError = err.data.error;
        } else if (resp) {
            this.finishStatus = resp.data.status;
            this.signUpError = undefined;
            this.nameProvided = true;
            this.focusLink = true;
        }
    }

    private forgotPassword() {
        this.resetPassword = true;
        this.beginSignup();
    }

    private getTitle() {
        if (!this.showSignup) {
            return "Log in";
        } else if (this.resetPassword) {
            return "Reset password";
        } else {
            return "Sign up";
        }
    }

    private cancelSignup() {
        this.showSignup = false;
        this.resetPassword = false;
    }

    private getEmailOrUserText(capitalize?: boolean) {
        let txt;
        if (this.resetPassword) {
            txt = "email or username";
        } else {
            txt = "email";
        }
        if (capitalize) {
            return capitalizeFirstLetter(txt);
        } else {
            return txt;
        }
    }
}

timApp.component("loginMenu", {
    bindings: {},
    controller: LoginMenuController,
    templateUrl: "/static/templates/loginMenu.html",
});
