import {HttpClient, HttpClientModule} from "@angular/common/http";
import {
    ApplicationRef,
    Component,
    DoBootstrap,
    DoCheck,
    Input,
    NgModule,
} from "@angular/core";
import {showMessageDialog} from "tim/ui/showMessageDialog";
import {showAddContactDialog} from "tim/user/showAddContactDialog";
import {Channel} from "tim/messaging/listOptionTypes";
import {TimUtilityModule} from "tim/ui/tim-utility.module";
import {createDowngradedModule, doDowngrade} from "tim/downgrade";
import {platformBrowserDynamic} from "@angular/platform-browser-dynamic";
import {BrowserModule} from "@angular/platform-browser";
import {FormsModule} from "@angular/forms";
import {ConsentType} from "../ui/consent";
import {
    ICssFile,
    INotification,
    ISettings,
    settingsglobals,
} from "../util/globals";
import {IOkResponse, timeout, to2} from "../util/utils";
import {IContactInfo, IFullUser} from "./IUser";

@Component({
    selector: "tim-save-button",
    template: `
        <button class="timButton" [disabled]="saving" (click)="save()">Save changes</button>
        <tim-loading *ngIf="saving"></tim-loading>
    `,
})
export class SaveButtonComponent {
    saving = false;
    @Input() saved?: () => Promise<unknown>;

    async save() {
        this.saving = true;
        await this.saved?.();
        this.saving = false;
    }
}

@Component({
    selector: "user-settings",
    template: `
    `,
})
export class UserSettingsComponent {}

const EDITABLE_CONTACT_CHANNELS: Partial<Record<Channel, string>> = {
    [Channel.EMAIL]: $localize`Emails`,
};

@Component({
    selector: "tim-settings",
    template: `
        <h1>TIM settings</h1>
        <div class="form">
            <bootstrap-panel title="Preferred language">
                <div class="flex cl">
                    <tim-language-selector></tim-language-selector>
                    <tim-save-button [saved]="submit"></tim-save-button>
                </div>
            </bootstrap-panel>
            <bootstrap-panel title="Styles">
                <span *ngIf="cssFiles">Available themes:</span>
                <span *ngIf="!cssFiles">There are no available themes.</span>
                <div *ngFor="let css_file of cssFiles"
                     class="checkbox"><label>
                    <input type="checkbox"
                           name="settings.css_files[css_file.name]"
                           [(ngModel)]="settings.css_files[css_file.name]"
                           (change)="submit()"
                           [disabled]="saving">
                    <a href="/static/stylesheets/themes/{{ css_file.name }}.scss">
                        {{ css_file.name }}</a> - {{ css_file.desc }}
                </label></div>
                <div class="form-group">
                    <label for="customCssArea">Custom CSS:</label>
                    <textarea rows="15" id="customCssArea" class="form-control"
                              [(ngModel)]="settings.custom_css"></textarea>
                </div>
                <tim-save-button [saved]="submit"></tim-save-button>
                <button class="btn btn-default" (click)="addPrintSettings()">Add Print Settings</button>

            </bootstrap-panel>
            <bootstrap-panel title="Editor">
                <div class="checkbox">
                    <label>
                        <input type="checkbox" [(ngModel)]="settings.use_document_word_list">
                        Use words from the document in ACE editor autocomplete
                    </label>
                </div>
                <label>ACE editor additional word list for autocomplete (1 word per line)
                    <textarea rows="15" class="form-control" [(ngModel)]="settings.word_list"></textarea>
                </label>
                <div>
                    <tim-save-button [saved]="submit"></tim-save-button>
                </div>
            </bootstrap-panel>
            <bootstrap-panel title="Notifications">
                <h4>Subscribed items</h4>
                <p *ngIf="notifications.length > 0">You get emails from the following documents and folders:</p>
                <p *ngIf="notifications.length === 0">You haven't subscribed to any documents or folders.</p>
                <ul>
                    <li *ngFor="let n of notifications">
                        <a href="/manage/{{n.item.path}}">
                            <span *ngIf="n.item.isFolder" class="glyphicon glyphicon-folder-open"></span>
                            {{n.item.title}}</a>
                        <span *ngIf="n.email_doc_modify"
                              class="glyphicon glyphicon-pencil"
                              tooltip="Document modifications"></span>
                        <span *ngIf="n.email_comment_add"
                              class="glyphicon glyphicon-comment"
                              tooltip="New comments"></span>
                        <span *ngIf="n.email_comment_modify"
                              class="glyphicon glyphicon-comment"
                              tooltip="Comment modifications"></span>
                    </li>
                </ul>
                <button (click)="getAllNotifications()"
                        class="timButton"
                        *ngIf="showGetAllNotifications()">
                    Show all
                </button>
                <h4>Exclusion list</h4>
                <p>
                    Sometimes you may want to subscribe to emails from a folder but exclude some documents within it.
                    Using the list below you can specify which folders and documents should be excluded from your email
                    subscriptions.
                </p>
                <p>Type one regular expression per line that should match any part of the path of the folder or
                    document,
                    e.g. <code>/ht/</code> would match any path with <code>/ht/</code> in it.</p>
                <div class="form-group">
        <textarea class="form-control" rows="5" [(ngModel)]="settings.email_exclude">
        </textarea>
                </div>

                <div>
                    <tim-save-button [saved]="submit"></tim-save-button>
                </div>

            </bootstrap-panel>
            <bootstrap-panel title="Menus">
                <form>
                    <fieldset class="form-view" [disabled]="saving">
                        <label for="max-toc-size" class="input-group-label">Collapse document index with more
                            than</label>
                        <div class="form-item">
                            <div class="input-group">
                                <input type="number" name="max_uncollapsed_toc_items" min="0" class="form-control"
                                       id="max-toc-size" placeholder="40 (default)"
                                       [(ngModel)]="settings.max_uncollapsed_toc_items">
                                <span class="input-group-addon">items</span>
                            </div>
                            <button class="timButton" (click)="settings.max_uncollapsed_toc_items = null">Clear</button>
                        </div>

                        <span>Opening settings</span>
                        <div>
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" name="disable_menu_hover"
                                           [(ngModel)]="settings.disable_menu_hover"
                                           [disabled]="saving"> Disable opening menus with mouse hover
                                </label>
                            </div>
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" name="remember_last_sidebar_menu_tab"
                                           [(ngModel)]="settings.remember_last_sidebar_menu_tab"
                                           [disabled]="saving"> Side bar menu: remember the last selected tab
                                </label>
                            </div>
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" name="remember_last_sidebar_menu_state"
                                           [(ngModel)]="settings.remember_last_sidebar_menu_state"
                                           [disabled]="saving"> Side bar menu: remember the last open state
                                </label>
                            </div>
                        </div>
                    </fieldset>
                </form>


                <tim-save-button [saved]="submit"></tim-save-button>
            </bootstrap-panel>
            <bootstrap-panel title="Other settings">
                <div class="checkbox" id="othersettings"><label>
                    <input type="checkbox" name="auto_mark_all_read" [(ngModel)]="settings.auto_mark_all_read"
                           [disabled]="saving"> Automatically mark document as read when opening it for the first time
                </label></div>
                <span class="space-right"><tim-save-button [saved]="submit"></tim-save-button></span>
                <button class="btn btn-default" (click)="clearLocalStorage()">Clear local settings storage</button>
                <span *ngIf="storageClear">Local storage cleared.</span>
            </bootstrap-panel>
            <bootstrap-panel title="Your account information">
                <form class="account-info">
                    <label for="account-name">Username</label>
                    <div><input id="account-name" class="form-control" type="text" [value]="user.name" disabled></div>
                    <label for="account-id">Account ID</label>
                    <div><input id="account-id" class="form-control" type="text" [value]="user.id" disabled></div>
                    <label for="account-real-name">Full name</label>
                    <div><input id="account-real-name" class="form-control" type="text" [value]="user.real_name"
                                disabled></div>
                    <label for="account-email-primary">Primary email</label>
                    <div>
                        <select id="account-email-primary" class="form-control">
                            <option>{{user.email}}</option>
                        </select>
                    </div>
                    <ng-container *ngFor="let entry of userContacts.entries()">
                        <span class="form-label">{{channelNames[entry[0]]}}</span>
                        <div class="contact-collection">
                            <div class="contact-info" *ngFor="let contact of entry[1]">
                                <input type="text" class="form-control" [value]="contact.contact" disabled>
                                <span *ngIf="contact.primary" class="primary-badge">Primary</span>
                                <span *ngIf="contact.verified" class="verified-badge">Verified</span>
                                <button *ngIf="!contact.verified" class="btn btn-default">Resend verification</button>
                                <button class="btn btn-danger" type="button" [disabled]="contact.primary">
                                    <i class="glyphicon glyphicon-trash"></i>
                                </button>
                            </div>
                        </div>
                    </ng-container>
                </form>
                <div class="button-panel">
                    <button class="timButton" (click)="openContactInfoDialog()">Add new contact</button>
                </div>
            </bootstrap-panel>
            <bootstrap-panel title="Delete your account">
                <button class="timButton btn-danger"
                        (click)="beginDeleteAccount()"
                        *ngIf="!deletingAccount">Delete account...
                </button>
                <div *ngIf="deletingAccount">
                    To delete your account, please type your username ({{ user.name }}) in the field below
                    and then click "Delete account now".
                    <div class="form-inline">
                        <input class="form-control"
                               type="text"
                               [(ngModel)]="deleteConfirmName">
                        <button [disabled]="user.name !== deleteConfirmName"
                                class="timButton btn-danger"
                                (click)="deleteAccount()">Delete account now
                        </button>
                        <button class="timButton btn-default" (click)="deletingAccount = false">Cancel</button>
                    </div>
                </div>
            </bootstrap-panel>
        </div>
    `,
    styleUrls: ["settings.component.scss"],
})
export class SettingsComponent implements DoCheck {
    saving = false;
    settings: ISettings;
    cssFiles: Array<ICssFile>;
    notifications: INotification[];
    storageClear = false;
    user: IFullUser;
    deletingAccount = false;
    deleteConfirmName = "";
    contacts: IContactInfo[];
    userContacts = new Map<Channel, IContactInfo[]>();
    channelNames = EDITABLE_CONTACT_CHANNELS;
    private readonly style: HTMLStyleElement;
    private readonly consent: ConsentType | undefined;
    private allNotificationsFetched = false;

    constructor(private http: HttpClient) {
        this.user = settingsglobals().current_user;
        this.consent = this.user.consent;
        this.settings = settingsglobals().userPrefs;
        this.cssFiles = settingsglobals().css_files;
        this.notifications = settingsglobals().notifications;
        this.contacts = settingsglobals().contacts;
        this.collectUserContacts();
        this.updateCss();
        this.style = document.createElement("style");
        this.style.type = "text/css";
        document.getElementsByTagName("head")[0].appendChild(this.style);
    }

    ngDoCheck() {
        this.style.innerHTML = this.settings.custom_css;
    }

    submit = async () => {
        this.saving = true;
        const r = await to2(
            this.http
                .post<ISettings>("/settings/save", this.settings)
                .toPromise()
        );
        this.saving = false;
        if (r.ok) {
            this.settings = r.result;
            this.updateCss();
        } else {
            await showMessageDialog(r.result.error.error);
        }
    };

    async updateConsent() {
        if (this.consent == null) {
            return;
        }
        this.saving = true;
        await this.setConsent(this.consent);
        this.saving = false;
    }

    updateCss() {
        document
            .querySelector(
                // There are two stylesheets in production (the other is the Angular-generated /js/styles.<hash>.css),
                // so we need the href match too.
                'link[rel="stylesheet"][href*="/static/generated/"]'
            )!
            .setAttribute(
                "href",
                `/static/generated/${this.settings.css_combined}.css`
            );
    }

    async clearLocalStorage() {
        window.localStorage.clear();
        this.storageClear = true;
        await timeout(3000);
        this.storageClear = false;
    }

    async addPrintSettings() {
        const resp = await to2(
            this.http
                .get<string>("/static/stylesheets/userPrintSettings.css")
                .toPromise()
        );
        if (!resp.ok) {
            return;
        }
        this.settings.custom_css = resp.result;
    }

    async getAllNotifications() {
        const resp = await to2(
            this.http.get<INotification[]>("/notify/all").toPromise()
        );
        if (resp.ok) {
            this.notifications = resp.result;
            this.allNotificationsFetched = true;
        } else {
            await showMessageDialog(resp.result.error.error);
        }
    }

    showGetAllNotifications() {
        return (
            this.notifications.length === settingsglobals().notificationLimit &&
            !this.allNotificationsFetched
        );
    }

    beginDeleteAccount() {
        this.deleteConfirmName = "";
        this.deletingAccount = true;
    }

    async deleteAccount() {
        if (
            window.confirm(
                `Are you sure you want to delete your account (${this.user.name})?`
            )
        ) {
            const r = await to2(
                this.http.post("/settings/account/delete", {}).toPromise()
            );
            if (r.ok) {
                location.href = "/";
            } else {
                await showMessageDialog(r.result.error.error);
            }
        }
    }

    /**
     * Open a dialog for user to add additional contact information.
     */
    async openContactInfoDialog() {
        return await showAddContactDialog();
    }

    private collectUserContacts() {
        for (const contactInfo of this.contacts) {
            if (!EDITABLE_CONTACT_CHANNELS[contactInfo.channel]) {
                continue;
            }
            if (!this.userContacts.has(contactInfo.channel)) {
                this.userContacts.set(contactInfo.channel, []);
            }
            this.userContacts.get(contactInfo.channel)!.push(contactInfo);
        }
    }

    private async setConsent(c: ConsentType) {
        const r = await to2(
            this.http
                .post<IOkResponse>("/settings/updateConsent", {consent: c})
                .toPromise()
        );
        if (r.ok) {
            // Nothing to do.
        } else {
            await showMessageDialog(r.result.error.error);
        }
    }
}

@NgModule({
    declarations: [
        UserSettingsComponent,
        SettingsComponent,
        SaveButtonComponent,
    ],
    exports: [SettingsComponent],
    imports: [BrowserModule, TimUtilityModule, HttpClientModule, FormsModule],
})
export class SettingsModule implements DoBootstrap {
    ngDoBootstrap(appRef: ApplicationRef): void {}
}

export const angularJsModule = createDowngradedModule((extraProviders) => {
    const platformRef = platformBrowserDynamic(extraProviders);
    return platformRef.bootstrapModule(SettingsModule);
});
doDowngrade(angularJsModule, "timSettings", SettingsComponent);
export const moduleDefs = [angularJsModule];
