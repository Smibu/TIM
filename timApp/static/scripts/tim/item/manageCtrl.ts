import {IController, IFormController, IHttpResponse} from "angular";
import {timApp} from "tim/app";
import {IChangelogEntry, IManageResponse} from "../document/editing/edittypes";
import {isManageResponse, showRenameDialog} from "../document/editing/pluginRenameForm";
import * as copyFolder from "../folder/copyFolder";
import {showMessageDialog} from "../ui/dialog";
import {$http, $timeout, $upload, $window} from "../util/ngimport";
import {markAsUsed, to} from "../util/utils";
import {IItem} from "./IItem";

markAsUsed(copyFolder);

export interface ITranslation {
    id: number;
    old_langid: string;
    lang_id: string;
    old_title: string;
    title: string;
}

export interface IAlias {
    name: string;
    location: string;
    path: string;
    publicChanged: boolean;
    public: boolean;
}

export class PermCtrl implements IController {
    private wikiRoot: string;
    private newTitle: string;
    private newFolderName: string;
    private hasMoreChangelog?: boolean;
    private translations: Array<IItem & {old_title: string}> = [];
    private newTranslation: {language: string, title: string};
    private accessTypes: Array<{}>;
    private item: IItem;
    private newName?: string;
    private oldFolderName?: string;
    private oldName?: string;
    private fulltext?: string;
    private changelogLoading: boolean = false;
    private newAlias: {location: string};
    private copyParams: {copy: number};
    private citeParams: {cite: number};
    private aliases: IItem[] = [];
    private old_title?: string;
    private fileUploadError: string | undefined;
    private tracWikiText: string = "";
    private saving: boolean = false;
    private readUpdating: boolean = false;
    private file: any;
    private newAliasForm!: IFormController; // initialized in the template
    private notifySettings: {} = {};
    private objName: string;

    constructor() {
        this.newTranslation = {language: "", title: ""};
        this.accessTypes = $window.accessTypes;
        this.item = $window.item;
        this.objName = $window.objName;
        this.newFolderName = this.item.location;
        this.newAlias = {location: this.newFolderName};
        this.wikiRoot = "https://trac.cc.jyu.fi/projects/ohj2/wiki/"; // Todo: replace something remembers users last choice
        this.hasMoreChangelog = true;
        this.newTitle = this.item.title;
        this.copyParams = {copy: this.item.id};
        this.citeParams = {cite: this.item.id};
        this.translations = [];
    }

    async $onInit() {
        this.getNotifySettings();
        if (this.item.isFolder) {
            this.newName = this.item.name;
            this.newFolderName = this.item.location;
            this.oldName = this.newName;
            this.oldFolderName = this.newFolderName;
        } else {
            this.updateFullText(this.item.fulltext);
            if (this.item.rights.manage) {
                await this.getAliases();
                await this.getTranslations();
            }
        }
    }

    async showMoreChangelog() {
        const newLength = this.item.versions.length + 100;
        this.changelogLoading = true;
        const r = await to($http.get<{versions: IChangelogEntry[]}>("/changelog/" + this.item.id + "/" + (newLength)));
        this.changelogLoading = false;
        if (r.ok) {
            this.item.versions = r.result.data.versions;
            this.hasMoreChangelog = this.item.versions.length === newLength;
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async getAliases() {
        const r = await to($http.get<IItem[]>("/alias/" + this.item.id, {}));
        if (r.ok) {
            const data = r.result.data;
            if (this.aliases && this.aliases.length > 0 &&
                data.length > 0 &&
                data[0].path !== this.aliases[0].path) {
                // The first name has changed, reload to update the links
                window.location.replace("/manage/" + data[0].path);
            } else {
                this.aliases = data;
            }
            // mark the form pristine; otherwise it will complain about required field unnecessarily
            this.newAliasForm.$setPristine();
            this.newAlias = {location: this.item.location};
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async getTranslations() {
        if (this.item.isFolder) {
            return [];
        }

        const r = await to($http.get<Array<{lang_id: string, title: string}>>("/translations/" + this.item.id, {}));
        if (r.ok) {
            const data = r.result.data;
            this.translations = [];

            for (const tr of data) {
                const trnew = JSON.parse(JSON.stringify(tr));
                trnew.old_langid = tr.lang_id;
                trnew.old_title = tr.title;
                this.translations.push(trnew);
            }

            this.old_title = this.item.title;

        } else {
            await showMessageDialog(`Error loading translations: ${r.result.data.error}`);
        }

        return [];
    }

    trChanged(tr: ITranslation) {
        return tr.title !== tr.old_title || tr.lang_id !== tr.old_langid;
    }

    async updateTranslation(tr: ITranslation) {
        const r = await to($http.post("/translation/" + tr.id, {
            new_langid: tr.lang_id,
            new_title: tr.title,
            old_title: tr.old_title,
        }));
        if (r.ok) {
            await this.getTranslations();
            if (tr.id === this.item.id) {
                this.syncTitle(tr.title);
            }
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    syncTitle(title: string) {
        this.item.title = title;
        this.newTitle = title;
        $window.document.title = title + " - Manage - TIM";
        for (let i = 0; i < this.translations.length; ++i) {
            if (this.translations[i].id === this.item.id) {
                this.translations[i].title = title;
                this.translations[i].old_title = title;
            }
        }
    }

    async changeTitle() {
        if (!this.newTitle) {
            showMessageDialog("Title not provided.");
            return;
        }
        const r = await to($http.put("/changeTitle/" + this.item.id, {
            new_title: this.newTitle,
        }));
        if (r.ok) {
            this.syncTitle(this.newTitle);
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async renameFolder(newName: string) {
        const r = await to($http.put("/rename/" + this.item.id, {
            new_name: this.oldFolderName + "/" + newName,
        }));
        if (r.ok) {
            window.location.assign("/manage/" + this.oldFolderName + "/" + newName);
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async moveFolder(newLocation: string) {
        const r = await to($http.put("/rename/" + this.item.id, {
            new_name: newLocation + "/" + this.oldName,
        }));
        if (r.ok) {
            // This is needed to update the breadcrumbs
            location.reload();
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    combine(folder: string, name: string) {
        return (folder + "/" + name).replace(/(^\/+)|(\/+$)/, "");
    }

    aliasPublicClicked(alias: IAlias) {
        alias.public = !alias.public;
        alias.publicChanged = !alias.publicChanged;
    }

    aliasChanged(alias: IAlias) {
        return alias.publicChanged || alias.path !== this.combine(alias.location, alias.name);
    }

    async addAlias(newAlias: IAlias) {
        const path = encodeURIComponent(this.combine(newAlias.location || "", newAlias.name));
        const r = await to($http.put(`/alias/${this.item.id}/${path}`, {
            public: Boolean(newAlias.public),
        }));
        if (r.ok) {
            await this.getAliases();
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async removeAlias(alias: IAlias) {
        const r = await to($http.delete("/alias/" + encodeURIComponent(alias.path), {}));
        if (r.ok) {
            await this.getAliases();
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async updateAlias(alias: IAlias, first: boolean) {
        const newAlias = this.combine(alias.location, alias.name);
        const r = await to($http.post("/alias/" + encodeURIComponent(alias.path), {
            public: Boolean(alias.public),
            new_name: newAlias,
        }));
        if (r.ok) {
            if (!first || newAlias === alias.path) {
                await this.getAliases();
            } else {
                location.replace("/manage/" + newAlias);
            }
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async deleteDocument() {
        if (window.confirm("Are you sure you want to delete this document?")) {
            const r = await to($http.delete("/documents/" + this.item.id));
            if (r.ok) {
                location.replace(`/view/${this.item.location}`);
            } else {
                await showMessageDialog(r.result.data.error);
            }
        }
    }

    async deleteFolder(folderId: number) {
        if (window.confirm("Are you sure you want to delete this folder?")) {
            const r = await to($http.delete("/folders/" + folderId));
            if (r.ok) {
                location.replace(`/view/${this.item.location}`);
            } else {
                await showMessageDialog(r.result.data.error);
            }
        }
    }

    updateDocument(file: any) {
        this.file = file;
        this.fileUploadError = undefined;
        if (file) {
            this.file.progress = 0;
            file.upload = $upload.upload({
                url: "/update/" + this.item.id,
                data: {
                    file,
                    original: this.item.fulltext,
                    version: this.item.versions[0],
                },
                method: "POST",
            });

            file.upload.then((response: any) => {
                $timeout(() => {
                    this.file.result = response.data;
                    this.item.versions = response.data.versions;
                    this.updateFullText(response.data.fulltext);
                });
            }, (response: any) => {
                if (response.status > 0) {
                    this.fileUploadError = "Error: " + response.data.error;
                }
            }, (evt: any) => {
                this.file.progress = Math.min(100, Math.floor(100.0 *
                    evt.loaded / evt.total));
            });

            file.upload.finally(() => {
            });
        }
    }

    convertDocument(doc: string) {
        if (!this.wikiRoot) {
            showMessageDialog("Wiki root missing.");
            return;
        }
        let text = this.tracWikiText;
        const wikiSource = this.wikiRoot.replace("wiki", "browser");
        // var text = this.fulltext;
        text = text.replace(/\[\[PageOutline\]\].*\n/g, "");  // remove contents
        text = text.replace(/ !([a-zA-Z])/g, " $1");                   // remove cat !IsBig
        text = text.replace(/\r\n/g, "\n");                   // change windows nl's
        text = text.replace(/{{{(.*?)}}}/g, "`$1`");         // change verbatim
        // text = text.replace(/{{{\n(.*?)\n}}}/, "```\n$1\n```"); // change code blocks
        text = text.replace(/\n{{{#!comment\n((.|\s|\S)*?)\n}}}\n/g, "\n#- {.comment}\n$1\n#-\n"); // comments
        text = text.replace(/\n{{{\n/g, "\n#-\n```\n"); // change code blocks
        text = text.replace(/\n}}}\n/g, "\n```\n"); // change code blocks
        text = text.replace(/\n====\s+(.*?)\s+====.*\n/g, "\n#-\n#### $1\n"); // headings
        text = text.replace(/\n===\s+(.*?)\s+===.*\n/g, "\n#-\n### $1\n");
        text = text.replace(/\n==\s+(.*?)\s+==.*\n/g, "\n#-\n## $1\n");
        text = text.replace(/\n=\s+(.*?)\s+=.*\n/g, "\n#-\n# $1\n");
        // text = text.replace(/^ \d+. ', r'1.');
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (true || line.lastIndexOf("    ", 0) !== 0) {
                line = line.replace(/\[((https?|mms):\/\/[^\s\[\]]+)\s+([^\[\]]+)\]/g, "[$3]($1)"); // ordinary links
                line = line.replace(/\[((https?|mms):\/\/[^\s\[\]]+)\s+(\[.*?\])\]/g, "[$3]($1)");   // links like [url [text]]
                line = line.replace(/\[wiki:([^\s\[\]]+)\]/g, "[$1](" + (this.wikiRoot || "") + "$1)"); // [wiki:local] -> [local](URL)
                line = line.replace(/\[wiki:([^\s\[\]]+)\s+([^\[\]]+)\]/g, "[$2](" + (this.wikiRoot || "") + "$1)"); // [wiki:local text] -> [text](URL)
                line = line.replace(/\[source:([^\s\[\]]+)\s+([^\[\]]+)\]/g, "[$2](" + (wikiSource || "") + "$1)");
                line = line.replace(/\!(([A-Z][a-z0-9]+){2,})/, "$1");
                line = line.replace(/\'\'\'(.*?)\'\'\'/, "**$1**");  // bold
                line = line.replace(/\'\'(.*?)\'\'/, "*$1*");   // italics
            }
            lines[i] = line;
        }
        text = lines.join("\n");

        /*

         text = re.sub(r'(?m)^====\s+(.*?)\s+====.*$', r'#-\n#### \1', text)
         text = re.sub(r'(?m)^===\s+(.*?)\s+===.*$', r'#-\n### \1', text)
         text = re.sub(r'(?m)^==\s+(.*?)\s+==.*$', r'#-\n## \1', text)
         text = re.sub(r'(?m)^=\s+(.*?)\s+=.*$', r'#-\n# \1', text)
         #text = re.sub(r'^       * ', r'****', text)
         #text = re.sub(r'^     * ', r'***', text)
         #text = re.sub(r'^   * ', r'**', text)
         #text = re.sub(r'^ * ', r'*', text)
         text = re.sub(r'^ \d+. ', r'1.', text)

         a = []
         for line in text.split('\n'):
         if True or not line.startswith('    '):
         line = re.sub(r'\[(https?://[^\s\[\]]+)\s([^\[\]]+)\]', r'[\2](\1)', line)
         line = re.sub(r'\[(wiki:[^\s\[\]]+)\s([^\[\]]+)\]', r'[\2](/\1/)', line)
         line = re.sub(r'\!(([A-Z][a-z0-9]+){2,})', r'\1', line)
         line = re.sub(r'\'\'\'(.*?)\'\'\'', r'*\1*', line)
         line = re.sub(r'\'\'(.*?)\'\'', r'_\1_', line)
         line = re.sub(r'\(/wiki:', r'(https://trac.cc.jyu.fi/projects/ohj2/wiki/', line)
         a.append(line)
         text = '\n'.join(a)
         */
        // this.tracWikiText = text;
        this.fulltext = text;
    }

    hasTextChanged() {
        return this.item.fulltext !== this.fulltext;
    }

    updateFullText(txt: string) {
        this.fulltext = txt.trim();
        this.item.fulltext = this.fulltext;
    }

    async saveDocument() {
        if (this.saving || !this.hasTextChanged()) {
            return;
        }
        this.saving = true;
        const r = await to<IHttpResponse<IManageResponse>,
            {data: {error: string, is_warning?: boolean}}>($http.post<IManageResponse>(`/update/${this.item.id}`,
            {
                fulltext: this.fulltext,
                original: this.item.fulltext,
                version: this.item.versions[0],
            }));
        if (r.ok) {
            let data = r.result.data;
            if (data.duplicates.length > 0) {
                const d = await to(showRenameDialog({
                    duplicates: data.duplicates,
                }));
                if (d.ok && isManageResponse(d.result)) {
                    data = d.result;
                }
            }
            this.updateFullText(data.fulltext);
            this.item.versions = data.versions;
            this.saving = false;
        } else {
            const data = r.result.data;
            this.saving = false;
            if (data.is_warning) {
                if (window.confirm(data.error + "\n\nDo you still wish to save the document?")) {
                    this.saveDocumentWithWarnings();
                }
            } else {
                await showMessageDialog(data.error);
            }
        }
    }

    async saveDocumentWithWarnings() {
        this.saving = true;
        const r = await to($http.post<IManageResponse>("/update/" + this.item.id,
            {
                fulltext: this.fulltext,
                original: this.item.fulltext,
                ignore_warnings: true,
                version: this.item.versions[0],
            }));
        this.saving = false;
        if (r.ok) {
            const data = r.result.data;
            this.updateFullText(data.fulltext);
            this.item.versions = data.versions;
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async markAllAsRead() {
        this.readUpdating = true;
        const r = await to($http.put("/read/" + this.item.id, {}));
        this.readUpdating = false;
        if (r.ok) {
            // nothing to do
        } else {
            await showMessageDialog("Could not mark the document as read.");
        }
    }

    async createTranslation() {
        const r = await to($http.post<{path: string}>(`/translate/${this.item.id}/${this.newTranslation.language}`, {
            doc_title: this.newTranslation.title,
        }));
        if (r.ok) {
            const data = r.result.data;
            location.href = "/view/" + data.path;
        } else {
            await showMessageDialog(r.result.data.error);
        }
    }

    async getNotifySettings() {
        const r = await to($http.get("/notify/" + this.item.id));
        if (r.ok) {
            this.notifySettings = r.result.data;
        } else {
            await showMessageDialog(`Could not get notification settings. Error message is: ${r.result.data.error}`);
        }
    }

    async notifyChanged() {
        const r = await to($http.post("/notify/" + this.item.id, this.notifySettings));
        if (r.ok) {
            // nothing to do
        } else {
            await showMessageDialog(`Could not change notification settings. Error message is: ${r.result.data.error}`);
        }
    }
}

timApp.component("timManage", {
    controller: PermCtrl,
    templateUrl: "/static/templates/manage.html",
});
