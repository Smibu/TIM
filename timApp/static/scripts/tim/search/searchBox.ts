/**
 * A search box component.
 */

import {IController} from "angular";
import {ngStorage} from "ngstorage";
import {timApp} from "../app";
import {IItem, ITag, ITaggedItem} from "../item/IItem";
import {$http, $localStorage, $window} from "../util/ngimport";
import {Binding, to} from "../util/utils";
import {ShowSearchResultController, showSearchResultDialog} from "./searchResultsCtrl";

/**
 * All data title/word search route returns.
 */
export interface ISearchResultsInfo {
    results: IDocSearchResult[];
    incomplete_search_reason: string; // Tells the reason why when the search is incomplete.
    wordResultCount: number;
    titleResultCount: number;
    errors: ISearchError[];
}

/**
 * Search error info for tag, word or title searches.
 */
export interface ISearchError {
    error: string;
    doc_path: string;
    par_id: string;
    tag_name: string;
}

/**
 * All data tag search route returns.
 */
export interface ITagSearchResultsInfo {
    results: ITagSearchResult[];
    incomplete_search_reason: string;
    tagResultCount: number;
    errors: ISearchError[];
}

/**
 * One document's search results.
 */
export interface IDocSearchResult {
    doc: IItem;
    par_results: IParSearchResult[];
    title_results: ITitleSearchResult[];
    num_par_results: number;
    num_title_results: number;
    incomplete: boolean;
}

/**
 * A paragraph's search results.
 */
export interface IParSearchResult {
    par_id: string;
    preview: string;
    results: IWordSearchResult[];
    num_results: number;
}

/**
 * Title search results including list of word matches in the title.
 */
export interface ITitleSearchResult {
    results: IWordSearchResult[];
    num_results: number;
}

/**
 * One match info with matched word and its location in par or title.
 */
export interface IWordSearchResult {
    match_word: string;
    match_start: number;
    match_end: number;
}

/**
 * One document's tag search results.
 */
export interface ITagSearchResult {
    doc: ITaggedItem;
    // Number of matches in the document's tags (not matching_tags length, because same tag may contain match
    // more than once.)
    num_results: number;
    matching_tags: ITag[]; // List of tags that matched the query.
}

export class SearchBoxCtrl implements IController {
    // Results and variables search results dialog needs to know.
    public results: IDocSearchResult[] = [];
    public resultErrorMessage: string = ""; // Message displayed only in results dialog.
    public tagMatchCount: number = 0;
    public wordMatchCount: number = 0;
    public titleMatchCount: number = 0;
    public tagResults: ITagSearchResult[] = [];
    public incompleteSearchReason: string = "";
    public query: string = "";
    public folder!: Binding<string, "<">;

    // Settings:
    private regex: boolean = false; // Regular expressions.
    private caseSensitive: boolean = false; // Take upper/lower case in account.
    private advancedSearch: boolean = false; // Toggle advanced options panel.
    private createNewWindow: boolean = false; // Open new dialog for each search.
    private ignorePluginsSettings: boolean = false; // Leave plugins and settings out of the results.
    private searchDocNames: boolean = true; // Doc title search. On by default.
    private searchTags: boolean = true; // Tag search. On by default.
    private searchWords: boolean = true; // Content search. On by default.
    private searchExactWords: boolean = false; // Whole word search.
    private maxDocResults: number = 100; // Limit for searched results per doc.
    private searchOwned: boolean = false; // Limit search to docs owned by the user.

    private errorMessage: string = ""; // Message displayed only in search panel.
    private focusMe: boolean = true;
    private loading: boolean = false; // Display loading icon.
    private item: IItem = $window.item;
    private storage: ngStorage.StorageService & {
        searchWordStorage: null | string,
        optionsStorage: null | boolean[],
        optionsValueStorage: null | number[]};
    private folderSuggestions: string[] = []; // A list of folder path suggestions.
    private resultsDialog: ShowSearchResultController | null = null; // The most recent search result dialog.

    constructor() {
        this.storage = $localStorage.$default({
            optionsStorage: null,
            optionsValueStorage: null,
            searchWordStorage: null,
        });
    }

    $onInit() {
        this.loadLocalStorage();
        this.defaultFolder();
        void this.loadFolderSuggestions();
    }

    $onDestroy() {
        this.updateLocalStorage();
    }

    /**
     * Word search on target folder.
     * @returns {Promise<void>}
     */
    async search() {
        if (this.loading) {
            return;
        }
        this.resetAttributes();
        this.loading = true;
        if (!this.searchDocNames && !this.searchTags && !this.searchWords) {
            this.errorMessage = (`All search scope options are unchecked.`);
            this.loading = false;
            return;
        }
        if (this.searchTags) {
            await this.tagSearch();
        }
        if (this.searchWords || this.searchDocNames) {
            // Server side has also a minimum length check for the query.
            if (!this.folder.trim() && this.searchWords && !this.searchOwned) {
                this.errorMessage = (`Content searches on root directory are not allowed.`);
                this.loading = false;
                return;
            }
            await this.wordSearch();
        }
        if (this.results.length === 0 && this.tagResults.length === 0 && !this.errorMessage) {
            this.errorMessage = `Your search '${this.query}' did not match any documents.`;
            this.loading = false;
            return;
        }
        if (this.errorMessage) {
            this.loading = false;
            return;
        }
        this.updateLocalStorage();
        if (this.incompleteSearchReason.length > 0) {
            this.resultErrorMessage = `Incomplete search: ${this.incompleteSearchReason}.` +
                ` For better results choose more specific search options.`;
        }
        if (this.createNewWindow) {
            void showSearchResultDialog(this);
        } else {
            if (!this.resultsDialog) {
                void showSearchResultDialog(this);
            } else {
                this.resultsDialog.updateAttributes(this);
            }
        }
        this.loading = false;
    }

    /**
     * Sets a search result controller.
     * @param {ShowSearchResultController} resultsDialog
     */
    registerResultsDialog(resultsDialog: ShowSearchResultController | null) {
        this.resultsDialog = resultsDialog;
    }

    /*
     * Calls search function when Enter is pressed.
     * @param event Keyboard event.
     */
    async keyPressed(event: KeyboardEvent) {
        // TODO: Causes "$digest already in progress" errors.
        if (event.which === 13) {
            await this.search();
        }
    }

    /**
     * Saves options and search word to local storage.
     */
    private updateLocalStorage() {
        if (this.query.trim().length > 0) {
            this.storage.searchWordStorage = this.query;
        }
        this.storage.optionsValueStorage = [];
        this.storage.optionsValueStorage.push(this.maxDocResults);

        this.storage.optionsStorage = [];
        // Alphabetical order.
        this.storage.optionsStorage.push(this.advancedSearch);
        this.storage.optionsStorage.push(this.caseSensitive);
        this.storage.optionsStorage.push(this.createNewWindow);
        this.storage.optionsStorage.push(this.ignorePluginsSettings);
        this.storage.optionsStorage.push(this.regex);
        this.storage.optionsStorage.push(this.searchDocNames);
        this.storage.optionsStorage.push(this.searchExactWords);
        this.storage.optionsStorage.push(this.searchTags);
        this.storage.optionsStorage.push(this.searchOwned);
        this.storage.optionsStorage.push(this.searchWords);
    }

    /**
     * Fetches options and search word from local storage, if existent.
     */
    private loadLocalStorage() {
        if (this.storage.searchWordStorage) {
            this.query = this.storage.searchWordStorage;
        }
        if (this.storage.optionsValueStorage && this.storage.optionsValueStorage.length > 0) {
            this.maxDocResults = this.storage.optionsValueStorage[0];
        }
        if (this.storage.optionsStorage && this.storage.optionsStorage.length > 9) {
            this.advancedSearch = this.storage.optionsStorage[0];
            this.caseSensitive = this.storage.optionsStorage[1];
            this.createNewWindow = this.storage.optionsStorage[2];
            this.ignorePluginsSettings = this.storage.optionsStorage[3];
            this.regex = this.storage.optionsStorage[4];
            this.searchDocNames = this.storage.optionsStorage[5];
            this.searchExactWords = this.storage.optionsStorage[6];
            this.searchTags = this.storage.optionsStorage[7];
            this.searchOwned = this.storage.optionsStorage[8];
            this.searchWords = this.storage.optionsStorage[9];
        }
    }

    /**
     * If the component doesn't get a default folder as parameter, decides it here.
     *
     * Rules:
     *
     * root -> kurssit
     * users/username/somesubfolders -> users/username
     * kurssit/faculty/course/somesubfolders -> kurssit/faculty/course
     * kurssit/faculty/course -> kurssit/faculty/course
     * somefolder/somesubfolders -> somefolder
     */
    private defaultFolder() {
        if (!this.folder) {
            if (!this.item) {
                this.folder = "kurssit";
                return;
            }
            if (this.item.isFolder) {
                this.folder = this.item.path;
            } else {
                this.folder = this.item.location;
            }
            if (!this.folder) {
                this.folder = "kurssit";
            }
            const path = this.folder.split("/");
            if (path[0] === "users" && path.length >= 2) {
                this.folder = `${path[0]}/${path[1]}`;
                return;
            }
            if (path[0] === "kurssit" && path.length >= 3) {
                this.folder = `${path[0]}/${path[1]}/${path[2]}`;
                return;
            }
            if (path[0] === "kurssit" && path.length >= 2) {
                return;
            }
            if (path.length > 1) {
                this.folder = `${path[0]}`;
                return;
            }
        }
    }

    /**
     * Document word and title search.
     * @returns {Promise<void>}
     */
    private async wordSearch() {
        const [err, response] = await to($http<ISearchResultsInfo>({
            method: "GET",
            params: {
                caseSensitive: this.caseSensitive,
                folder: this.folder,
                ignorePluginsSettings: this.ignorePluginsSettings,
                maxDocPars: 1000,
                maxDocResults: this.maxDocResults,
                maxTime: 15,
                maxTotalResults: 10000,
                query: this.query,
                regex: this.regex,
                searchDocNames: this.searchDocNames,
                searchExactWords: this.searchExactWords,
                searchOwned: this.searchOwned,
                searchWords: this.searchWords,
            },
            url: "/search",
        }));
        if (err) {
            let tempError = "";
            // Basic error message from server.
            if (err.data.error) {
                tempError = err.data.error.toString();
            }
            // Some errors don't have err.data.error and are in raw HTML.
            if (err.data && tempError.length < 1) {
                tempError = removeHtmlTags(err.data.toString());
                if (tempError.indexOf("Proxy Error") > -1) {
                    tempError = tempError.replace("Proxy Error Proxy Error", "Proxy Error:").
                    replace("&nbsp;", " ");
                }
            }
            if (tempError.length < 1) {
                tempError = "Unknown error";
            }
            this.errorMessage = tempError;
            this.results = [];
            return;
        }
        if (response) {
            this.results = response.data.results;
            this.incompleteSearchReason = response.data.incomplete_search_reason;
            this.wordMatchCount = response.data.wordResultCount;
            this.titleMatchCount = response.data.titleResultCount;
            // if (response.data.errors.length > 0) {
            //     console.log("Errors were encountered during search:");
            //     console.log(response.data.errors);
            // }
        }
    }

    /**
     * Search document tags.
     * @returns {Promise<void>}
     */
    private async tagSearch() {
        const [err, response] = await to($http<ITagSearchResultsInfo>({
            method: "GET",
            params: {
                caseSensitive: this.caseSensitive,
                folder: this.folder,
                query: this.query,
                regex: this.regex,
                searchExactWords: this.searchExactWords,
                searchOwned: this.searchOwned,
            },
            url: "/search/tags",
        }));
        if (response) {
            // if (response.data.errors.length > 0) {
            //     console.log("Errors were encountered during tag search:");
            //     console.log(response.data.errors);
            // }
            this.tagResults = response.data.results;
            this.tagMatchCount = response.data.tagResultCount;
            this.incompleteSearchReason = response.data.incomplete_search_reason;
        }
        if (err) {
            let tempError = "";
            if (err.data.error) {
                tempError = err.data.error.toString();
            }
            if (err.data && tempError.length < 1) {
                // Proxy error data is in raw HTML format, so this is to make it more readable.
                tempError = removeHtmlTags(err.data.toString());
                if (tempError.indexOf("Proxy Error") > -1) {
                    tempError = tempError.replace("Proxy ErrorProxy Error", "Proxy Error ").
                    replace(".R", ". R").replace("&nbsp;", " ");
                }
            }
            if (tempError.length < 1) {
                tempError = "Unknown error";
            }
            this.errorMessage = tempError;
            this.tagResults = [];
            return;
        }

    }

    /**
     * Make a list of folder paths.
     * @returns {Promise<void>}
     */
    private async loadFolderSuggestions() {
        // TODO: Load from an index / partition load to get all folders faster?
        // Currently goes only three levels deep to save time.
        const response = await $http<string[]>({
            method: "GET",
            params: {
                folder: "",
            },
            url: "/search/getFolders",
        });
        if (response) {
            this.folderSuggestions = response.data;
        }
    }

    /**
     * Reset all search specific attributes to avoid them carrying over to following searches.
     */
    private resetAttributes() {
        this.tagMatchCount = 0;
        this.wordMatchCount = 0;
        this.titleMatchCount = 0;
        this.tagResults = [];
        this.results = [];
        this.errorMessage = "";
        this.resultErrorMessage = "";
    }

    /**
     * Format search button tooltip based on the situation.
     * @returns {string}
     */
    private searchButtonTooltip() {
        if (this.query.length < 1) {
            return "Input a search word to search";
        }
        if (this.loading) {
            return `Please wait, searching '${this.query}'`;
        } else {
            return `Search with '${this.query}'`;
        }
    }
}

/**
 * Removes HTML tags, linebreaks and extra white spaces.
 * @param {string} str
 * @returns {string}
 */
function removeHtmlTags(str: string) {
    return str.replace(/<{1}[^<>]{1,}>{1}/g, " ").
        replace(/(\r\n\t|\n|\r\t)/gm, " ").
        replace(/\s+/g, " ").trim();
}

timApp.component("searchBox", {
    bindings: {
        folder: "<",
    },
    controller: SearchBoxCtrl,
    template: `<div class="input-group">
        <input ng-model="$ctrl.query" name="searchField" ng-keypress="$ctrl.keyPressed($event)"
               type="text" focus-me="$ctrl.focusMe"
               title="Search documents with a key word"
               placeholder="Input a search word"
               class="form-control" autocomplete="on">
        <span class="input-group-addon btn" ng-click="$ctrl.search()" title="{{$ctrl.searchButtonTooltip()}}">
                <span ng-show="$ctrl.loading" class="glyphicon glyphicon-refresh glyphicon-refresh-animate">
                </span>
                <span ng-hide="$ctrl.loading" class="glyphicon glyphicon-search"></span>
        </span>
        <span class="input-group-addon btn" ng-click="$ctrl.advancedSearch = !$ctrl.advancedSearch"
            title="Toggle advanced search">
                <span class="glyphicon glyphicon-menu-hamburger"></span>
        </span>
   </div>
   <div ng-cloak ng-show="$ctrl.errorMessage" class="alert alert-warning">
    <span class="glyphicon glyphicon-exclamation-sign"></span> {{$ctrl.errorMessage}}
   </div>
   <div ng-if="$ctrl.advancedSearch" title="Advanced search options">
      <h5>Advanced search options</h5>
      <form class="form-horizontal">
           <div class="form-group" title="Write folder path to search from">
                <label for="folder-selector" class="col-sm-4 control-label font-weight-normal"
                style="text-align:left;">Search folder:</label>
                <div class="col-sm-8">
                    <input ng-model="$ctrl.folder" name="folder-selector"
                           type="text" class="form-control" id="folder-selector" placeholder="Input a folder to search"
                           uib-typeahead="f as f for f in $ctrl.folderSuggestions | filter:$viewValue | limitTo:15"
                           typeahead-min-length="1">
                </div>
           </div>
            <div class="form-group" title="Input maximum number of searched content matches per a document">
                <label for="max-doc-results-selector" class="col-sm-7 control-label font-weight-normal"
                style="text-align:left;">Max content results / document:</label>
                <div class="col-sm-5">
                    <input ng-model="$ctrl.maxDocResults" name="max-doc-results-selector"
                           type="number" class="form-control" id="folder-selector"
                           placeholder="Input max # of results per document">
                </div>
            </div>
        <label class="font-weight-normal" title="Distinguish between upper and lower case letters">
            <input type="checkbox" ng-model="$ctrl.caseSensitive"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Case sensitive</label>
        <label class="font-weight-normal" title="Allow regular expressions">
            <input type="checkbox" ng-model="$ctrl.regex"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Regex</label>
        <label class="font-weight-normal" title="Leave plugins and settings out of the results">
            <input type="checkbox" ng-model="$ctrl.ignorePluginsSettings"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Ignore plugins and settings</label>
        <label class="font-weight-normal" title="Search only whole words with one or more character">
            <input type="checkbox" ng-model="$ctrl.searchExactWords"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Search whole words</label>
        <label class="font-weight-normal" title="Show result of each search in new window">
            <input type="checkbox" ng-model="$ctrl.createNewWindow"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Open new window for each search</label>
        <label class="font-weight-normal dropdown-item" title="Search documents you own">
            <input type="checkbox" ng-model="$ctrl.searchOwned"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Search owned documents</label>
        <h5 class="font-weight-normal">Search scope:</h5>
        <label class="font-weight-normal" title="Search document titles">
            <input type="checkbox" ng-model="$ctrl.searchDocNames"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Title search</label>
        <label class="font-weight-normal" title="Search document tags">
            <input type="checkbox" ng-model="$ctrl.searchTags"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Tag search</label>
        <label class="font-weight-normal" title="Search document content">
            <input type="checkbox" ng-model="$ctrl.searchWords"
            class="ng-pristine ng-untouched ng-valid ng-not-empty"> Content search</label>
      </form>
    </div>
`,
});
