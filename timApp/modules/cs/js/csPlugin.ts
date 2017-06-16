import angular from "angular";
import $ from "jquery";
import {IHttpService, IModule, INgModelController, ITimeoutService, ITranscludeFunction} from "angular";
import {$http, $sanitize, $timeout, $interval, $compile, $window, $sce, $upload} from "tim/ngimport";
import {ParCompiler} from "tim/services/parCompiler";
import {lazyLoad, lazyLoadMany, lazyLoadTS} from "tim/lazyLoad";
import {IAce, IAceEditor} from "tim/ace-types";
import * as csparsons from "./cs-parsons/csparsons";
import * as acemodule from "tim/ace";

interface Simcir {
    setupSimcir(element: JQuery, data: {});
    controller(element: JQuery);
}

interface CellInfo {
    array: CellInfo[];
    hide: string[];
    defaultLanguage: string;
    linked: boolean;
    outputLocation: string;
    inputLocation: string;
    mode: string;
    submit(event);
    code: string;
    evalButtonText: string;
    editor: any;
    collapse: any;
    session: any;
    interacts: any[];
}

interface Sagecell {
    allLanguages: string[];
    templates: { [name: string]: { editor: string, hide: string[] } };
    makeSagecell(args): CellInfo;
    deleteSagecell(cellInfo: CellInfo);
    moveInputForm(cellInfo: CellInfo);
    restoreInputForm(cellInfo: CellInfo);
}

interface GlowScriptWindow extends Window {
    runJavaScript?(text: string, args: string, input: string, wantsConsole: boolean): string;
    setDefLanguage?(language: string);
    getConsoleHeight?(): number;
}

interface GlowScriptFrame extends HTMLIFrameElement {
    contentWindow: GlowScriptWindow;
}

// js-parsons is unused; just declare a stub to make TS happy
declare class ParsonsWidget {
    static _graders: any;
    constructor(data: {});

    init(a: string, b: string);
    show();
}

interface ICSConsoleApp extends IModule {
    directiveFunction(type: string, isInput: boolean);
    Controller(scope: ICSConsoleAppScope,
               http: IHttpService,
               transclude: ITranscludeFunction,
               element: any,
               timeout: ITimeoutService);
    directiveTemplateCS(t: string, isInput: boolean);
}

type AttrType = {
    by: string,
    byCode: string,
    examples: string,
    type: string,
    user_id: string,
    path: string,
};

interface ICSConsoleAppScope extends IConsolePWDScope {
    handleKey(ev: KeyboardEvent);
    down();
    up();
    load();
    isShell: boolean;
    toggleSize();
    cursor: number;
    currentSize: string;
    isHtml: boolean;
    oldpwd: string;
    handler();
    currentInput: string;
    loadExample(i: number);
    pwd: string;
    attrs: AttrType;
    byCode: string;
    taskId: string;
    plugin: string;
    ident: string;
    content: AttrType;
    examples: {expr: string, title: string}[],
    history: {istem: string, ostem: string, input: string, response: string}[]
    focusOnInput(): void;
    submit(s: string): void;
}

interface ICSApp extends IModule {
    taunoPHIndex: number;
    directiveFunction(type: string, x: boolean);
    taunoNr: number;
    commentTrim(s: string): string;
    getHeading(a, key, $scope, defElem);
    set(scope: ICSAppScope, attrs: {}, key: string, def?: string | boolean | number): string;
    getParam(scope: ICSAppScope, name: string, def: string | boolean | number): string | boolean | number;
    directiveTemplateCS(t: string, isInput: boolean);
    getInt(s: string): number;
    countChars(str: string, char: string): number;
    Controller(scope: ICSAppScope,
               transclude: ITranscludeFunction);
    updateEditSize(scope: ICSAppScope);
    ifIs(value: string, name: string, def: string | number);
    doVariables(v: string, name: string): string;
    Hex2Str(s: string): string;
}

// TODO better name?
type Vid = { vid: string; w: any; h: any };

interface ICSAppScope extends IConsolePWDScope {
    safeApply(fn?: () => any);
    out: {write: Function, writeln: Function, canvas: Element};
    canvasHeight: number;
    canvasWidth: number;
    previewIFrame: JQuery;
    lastUserinput: string;
    lastUserargs: string;
    iframeLoadTries: number;
    gsDefaultLanguage: string;
    glowscript: boolean;
    fullhtml: string;
    iframeClientHeight: number;
    lastJS: string;
    closeFrame();
    codeInitialized: boolean;
    getCode(): string;
    irrotaKiinnita: string;
    english: boolean;
    canvas: HTMLCanvasElement;
    toggleFixed();
    canvasConsole: Console;
    writeln(s: string);
    write(s: string);
    moveCursor(dx: number, dy: number);
    element0: HTMLElement;
    mode: string;
    checkEditorModeLocalStorage();
    editorModes: string;
    initEditorKeyBindings();
    showCsParsons(sortable: Element);
    words: boolean;
    parsonsId: Vid;
    showJsParsons(parsonsEditDiv: Element);
    preview: HTMLElement;
    previewUrl: string;
    lastMD: string;
    file: {};
    postcode: string;
    precode: string;
    showCodeLocal();
    getReplacedCode(): string;
    replace: string;
    code: string;
    carretPos: number;
    indent: number;
    showCode();
    localcode: string;
    changeCodeLink();
    showCodeLink: string;
    showCodeOn: string;
    showCodeOff: string;
    stop: angular.IPromise<{}>;
    stopShow();
    editorModeIndecies: number[];
    initUserCode: boolean;
    editorMode: number;
    initCode();
    height: string;
    width: string;
    getVid(dw: number | string, dh: number | string): Vid;
    insertAtCursor(myField: HTMLTextAreaElement, myValue: string);
    addTextHtml(s: string): string;
    addText(s: string);
    taunoId: string;
    hideTauno();
    isHtml: boolean;
    comtestError: string;
    plugin: string;
    isAll: boolean;
    validityCheckMessage: string;
    validityCheck: string;
    userargs: string;
    userinput: string;
    cursor: string;
    tinyErrorStyle: {};
    runTestRed: boolean;
    runTestGreen: boolean;
    isRunning: boolean;
    error: string;
    csparson: any;
    parson: any;
    iframe: boolean;
    indices: string;
    variables: string;
    table: string;
    lang: string;
    taunotype: string;
    isSimcir: boolean;
    showTauno();
    showSimcir();
    copyFromSimcir();
    copyToSimcir();
    simcir2: JQuery;
    taunoHtml: HTMLElement;
    simcir: JQuery;
    isSage: boolean;
    noeditor: boolean;
    hideShowEditor();
    docLink: string;
    runDocument();
    type: string;
    runUnitTest();
    runTest();
    runCodeLink(nosave: boolean): void;
    jstype: string;
    nosave: boolean;
    selectedLanguage: string;
    runCodeCommon(nosave: boolean, extraMarkUp?: string): void;
    runError: string | boolean;
    runCodeIfCR(event: KeyboardEvent): void;
    logTime(msg: string): boolean;
    runCodeAuto(): void;
    muokattu: boolean;
    autoupdate: boolean;
    runned: boolean;
    runTimer: number;
    aceEditor: IAceEditor;
    edit: HTMLTextAreaElement;
    editorIndex: number;
    wrap: {n: number};
    checkWrap();
    element: JQuery;
    isMathCheck: boolean;
    processPluginMath: () => any;
    uploadedType: string;
    user_id: string;
    taskId: string;
    docURL: string;
    uploadresult: string;
    uploadedFile: string;
    ufile: {progress: number, error: string};
    onFileSelect: (file) => any;
    copyingFromTauno: boolean;
    runSuccess: boolean;
    viewCode: boolean;
    imgURL: string;
    resImage: string;
    result: string;
    taunoOn: boolean;
    errors: string[];
    htmlresult: string;
    svgImageSnippet: () => any;
    byCode: string;
    attrs: {
        path: string,
        by: string,
        byCode: string,
        uploadbycode: boolean,
        treplace: string,
        program: string,
        fullhtml: string,
        html: string,
        runeverytime: boolean,
        scripts: string,
    };
    usercode: string;
    minRows: number;
    maxRows: number;
    rows: number;
    wavURL: string;
    showUploaded(file: string, type: string): void;
    doRunCode(s: string, b: boolean, extraMarkup?: {}): void;
    $watch(s: string, param2: (newValue, oldValue) => any, b?: boolean): void;
    pushShowCodeNow(): void;
    runCode(): void;
    showMD(): void;
    showJS(): void;
    closeDocument(): void;
    setCircuitData(): void;
    getCircuitData(): Promise<string>;
    getJsParsonsCode(): string;
    checkIndent(): void;
    copyTauno(): void;
    showOtherEditor(editorMode: number): void;
    showCodeNow(): void;
    aceLoaded(ace: IAce, editor: IAceEditor): void;
}

interface IConsolePWDScope {
    path: string;
    attrs: {path: string};
    setPWD?(pwd: string);
    savestate: string;
}

interface IConsolePWD {
    pwdHolders: IConsolePWDScope[];
    currentPWD: {};
    register(scope: IConsolePWDScope);
    isUser(scope: IConsolePWDScope);
    setPWD(pwd: string, scope: IConsolePWDScope);
    getPWD(scope: IConsolePWDScope): string;
}

interface IUploadFileTypes {
    show: string[];
    is(types: string[], file: string): boolean;
    name(file: string): string;
}

interface ILanguageTypes {
    runTypes: string[];
    aceModes: string[];
    testTypes: string[];
    unitTestTypes: string[];
    impTestTypes: {};
    impUnitTestTypes: {};
    whatIsIn(types: string[], type: string, def: string): string;
    whatIsInAce(types: string[], type: string, def: string): string;
    isAllType(type: string): boolean;
    getRunType(type: string, def: string | boolean): string | boolean;
    getAceModeType(type: string, def: string): string;
    getTestType(type: string, language: string, def: string | boolean): string | boolean;
    getUnitTestType(type: string, language: string, def: string | boolean): string | boolean;
    isInArray<T>(word: T, array: T[]): boolean;
}

var csPluginStartTime = new Date();
/*
Sagea varten ks: https://github.com/sagemath/sagecell/blob/master/doc/embedding.rst#id3
*/

var csApp = angular.module('csApp', ['ngSanitize','ngFileUpload']) as ICSApp;
csApp.taunoPHIndex = 3;
csApp.directive('csRunner',[
  function () {	
       return csApp.directiveFunction('console',false); }]);
csApp.directive('csJypeliRunner', [function () { return csApp.directiveFunction('jypeli',false); }]);
csApp.directive('csComtestRunner', [function () { return csApp.directiveFunction('comtest',false); }]);
csApp.directive('csRunnerInput',[function () { return csApp.directiveFunction('console',true); }]);
csApp.directive('csJypeliRunnerInput', [function () { return csApp.directiveFunction('jypeli',true); }]);
csApp.directive('csComtestRunnerInput', [function () { return csApp.directiveFunction('comtest',true); }]);
csApp.directive('csTaunoRunner', [function () { return csApp.directiveFunction('tauno',false); }]);
csApp.directive('csTaunoRunnerInput', [function () { return csApp.directiveFunction('tauno',true); }]);
csApp.directive('csParsonsRunner', [function () { return csApp.directiveFunction('parsons',false); }]);
csApp.directive('csSageRunner', [function () { return csApp.directiveFunction('sage',true); }]);
csApp.directive('csSimcirRunner', [function () { return csApp.directiveFunction('simcir',false); }]);
csApp.directive('csTextRunner', [function () { return csApp.directiveFunction('text',false); }]);
// csApp.directive('csRunner',function() {	csApp.sanitize = $sanitize; return csApp.directiveFunction('console'); }); // jos ei tarviiis sanitize

function csLogTime(msg) {
   var d = new Date();       
   var diff = d.getTime() - csPluginStartTime.getTime();
   console.log("cs: " + d.toLocaleTimeString()+ " " + diff.valueOf() + " - " + msg);          
}   

csLogTime("directives done");


var TESTWITHOUTPLUGINS = true && false;
csApp.taunoNr = 0;

//==============================================================
// Global object to store every plugin that wants to
// know when pwd changes.  plugin must implement (or scope)
// setPWD method.  Also it should have property path = "user"
// to be able to register.
var ConsolePWD = {} as IConsolePWD;

ConsolePWD.pwdHolders = [];

ConsolePWD.currentPWD = {};

ConsolePWD.register = function(scope) {
    if ( !ConsolePWD.isUser(scope) ) return;
    ConsolePWD.pwdHolders.push(scope);
}    

ConsolePWD.isUser = function(scope) {
   return ( scope.path === "user" || (scope.attrs && scope.attrs.path == "user") );
}

ConsolePWD.setPWD = function(pwd,scope) {
    if ( !ConsolePWD.isUser(scope) || !scope.savestate) {
        if ( scope.setPWD )  scope.setPWD("/home/agent");
        return;
    }
    
    ConsolePWD.currentPWD[scope.savestate] = pwd;
    for (var i = 0; i <ConsolePWD.pwdHolders.length; i++) {
        var pwdHolder = ConsolePWD.pwdHolders[i];
        if ( pwdHolder.savestate === scope.savestate )
            pwdHolder.setPWD(pwd);
    }
}

ConsolePWD.getPWD = function(scope) {
    if (scope.savestate)
        return ConsolePWD.currentPWD[scope.savestate];
    return "/home/agent";
}
//==============================================================

//==============================================================
// For IE missing functions
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.lastIndexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

var browserName = null;
var getBrowserName = function() {
    return browserName = browserName || function() {
      var userAgent = navigator ? navigator.userAgent.toLowerCase() : "other";

      if(userAgent.indexOf("chrome") > -1)        return "chrome";
      else if(userAgent.indexOf("safari") > -1)   return "safari";
      else if(userAgent.indexOf("msie") > -1)     return "ie";
      else if(userAgent.indexOf("firefox") > -1)  return "firefox";
      // if ( userAgent.match(/Trident.*rv\:11\./) ) return "ie";'
      if ( userAgent.indexOf("trident/") >= 0 ) return "ie";
      return userAgent;
    }();
};


var isAcrobatInstalled = null;
function hasAcrobatInstalled() {
    if ( isAcrobatInstalled != null ) return isAcrobatInstalled;
    function getActiveXObject(name) {
      try { return new ActiveXObject(name); } catch(e) {}
    };

    isAcrobatInstalled = getActiveXObject('AcroPDF.PDF') || getActiveXObject('PDF.PdfCtrl');
    return isAcrobatInstalled;
}

var csJSTypes = ["js", "glowscript", "vpython", "html"];

// =================================================================================================================
// Known upload files

var uploadFileTypes = {} as IUploadFileTypes;
uploadFileTypes.show = ["pdf","xml"];

uploadFileTypes.is = function(types, file) {
    if (!file) return false;
    file = file.toLowerCase();
    for (var i=0; i< types.length; i++) {
        var t = types[i];
        if (file.endsWith(t)) {
            if (t !== 'pdf') return true;
            if (navigator.mimeTypes['application/pdf'] || hasAcrobatInstalled() || getBrowserName() == 'ie' ) return true;
            return false;
        }
    }
    return false;
}

uploadFileTypes.name = function(file) {
    return file.split('\\').pop().split('/').pop();
}

function resizeIframe(obj) {
  obj.style.height = obj.contentWindow.document.body.scrollHeight + 'px';
}

async function loadSimcir() {
    const modules = await lazyLoadMany(["simcir", "simcir/basicset", "simcir/library", "simcir/oma-kirjasto"]);
    return modules[0] as Simcir;
}

// =================================================================================================================
// Things for known languages

var languageTypes = {} as ILanguageTypes;
// What are known language types (be carefull not to include partial word):
languageTypes.runTypes     = ["css","jypeli","scala","java","graphics","cc","c++","shell","vpython","py","fs","clisp","jjs","psql","sql","alloy","text","cs","run","md","js","glowscript","sage","simcir","xml", "octave","lua", "swift","mathcheck","r", "html"];
languageTypes.aceModes     = ["css","csharp","scala","java","java"    ,"c_cpp","c_cpp","sh","python","python","fsharp","lisp","javascript","sql","sql","alloy","text","csharp","run","markdown","javascript","javascript","python","json","xml","octave","lua","swift","java","r", "html"];
// For editor modes see: http://ace.c9.io/build/kitchen-sink.html ja sieltä http://ace.c9.io/build/demo/kitchen-sink/demo.js

// What are known test types (be carefull not to include partial word):
languageTypes.testTypes = ["ccomtest","jcomtest","comtest","scomtest"];
languageTypes.unitTestTypes = ["junit","unit"];

// If test type is comtest, how to change it for specific languages
languageTypes.impTestTypes = {cs:"comtest", console:"comtest", cc:"ccomtest", java:"jcomtest", scala:"scomtest"};
languageTypes.impTestTypes["c++"] = "ccomtest";

// If test type is unit, how to change it for specific languages
languageTypes.impUnitTestTypes = {cs:"nunit", console:"nunit", cc:"cunit", java:"junit", scala:"junit"};
languageTypes.impUnitTestTypes["c++"] = "cunit";

languageTypes.whatIsIn = function (types, type, def) {

    if (!type) return def;
    type = type.toLowerCase();
    for (var i=0; i< types.length; i++)
        if ( type.indexOf(types[i]) >= 0 ) return types[i];
    return def;
};

languageTypes.whatIsInAce = function (types, type, def) {

    if (!type) return def;
    type = type.toLowerCase();
    for (var i=0; i< types.length; i++)
        if ( type.indexOf(types[i]) >= 0 ) return languageTypes.aceModes[i];
    return def;
};


languageTypes.isAllType = function(type) {

    if (!type) return false;
    type = type.toLowerCase();
    return type.indexOf("all") >= 0;
};


languageTypes.getRunType = function(type,def) {

    return this.whatIsIn(this.runTypes,type,def);
};

languageTypes.getAceModeType = function(type,def) {

    return this.whatIsInAce(this.runTypes,type,def);
};

languageTypes.getTestType = function(type,language,def) {

    var t = this.whatIsIn(this.testTypes,type,def);
    if ( t !== "comtest" ) return t;
    var lt = this.whatIsIn(this.runTypes,language,"console");
    var impt = this.impTestTypes[lt];
    if ( impt ) return impt;
    return t;     
};

languageTypes.getUnitTestType = function(type,language,def) {

    var t = this.whatIsIn(this.unitTestTypes,type,def);
    if ( t !== "unit" ) return t;
    var lt = this.whatIsIn(this.runTypes,language,"console");
    var impt = this.impUnitTestTypes[lt];
    if ( impt ) return impt;
    return t;     
};

languageTypes.isInArray = function(word,array) {
    for (var i=0; i< array.length; i++)
        if ( word === array[i] ) return true;
    return false;
    
}

// Wrap given text to max n chars length lines spliting from space
function wrapText(s, n)
{
    var lines = s.split("\n");
    var needJoin = false;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // lines[i] = "";
        var sep = "";
        if (line.length > n) {
            lines[i] = "";
            while (true) {
                var p = -1;
                if (line.length > n) {
                    p = line.lastIndexOf(" ", n);
                    if (p < 0) p = line.indexOf(" "); // long line
                }
                if (p < 0) {
                    lines[i] += sep + line;
                    break;
                }
                lines[i] += sep + line.substring(0, p);
                line = line.substring(p + 1);
                if ( i+1 < lines.length && (lines[i+1].length  > 0 && (" 0123456789-".indexOf(lines[i+1][0]) < 0 )  ) ) {
                    lines[i+1] = line + " " + lines[i+1];
                    needJoin = true;
                    break;
                }
                sep = "\n";
                needJoin = true;
            }
        }
    }
    if ( needJoin ) return {modified: true, s: lines.join("\n")};
    return {modified: false, s:s};
}


// =================================================================================================================

var removeXML = function(s) {

    s = s.replace(/^<\?xml [^>]*\?>/,"");
    s = s.replace(/(<svg [^>]*height="[0-9]+)pt/,"$1");
    s = s.replace(/(<svg [^>]*width="[0-9]+)pt/,"$1");
    return s;
};

var iotaPermutation = function(n) {
    var permutation = [];
    for (var i = 0; i < n; i++) permutation.push(i);
    return permutation;
};    
    


csApp.directive('contenteditable', ['$sce', function($sce) {

    return {
      restrict: 'A', // only activate on element attribute
      require: '?ngModel', // get a hold of NgModelController
      link: function(scope, element, attrs, ngModel: INgModelController) {
        if(!ngModel) return; // do nothing if no ng-model

        // Specify how UI should be updated
        ngModel.$render = function() {
          // element.html($sce.getTrustedHtml(ngModel.$viewValue || ''));
          element.text(ngModel.$viewValue || '');
        };

        // Listen for change events to enable binding
        element.on('blur keyup change', function() {
          scope.$apply(read);
        });
        read(); // initialize

        // Write data to the model
        function read() {
          // var html = element.html();
          var text = element.html();
		  // if ( text.indexOf("<div>") >= 0 )  { text = text.replace("<div>","").replace("</div>","\n"); element.html(text); }
          text = element.text();
          // When we clear the content editable the browser leaves a <br> behind
          // If strip-br attribute is provided then we strip this out
          // if( attrs.stripBr && html == '<br>' ) {
          //   html = '';
          // }
          ngModel.$setViewValue(text);
        }
      }
    };
  }]);


csApp.commentTrim = function(s) {

	if ( !s ) return "";
	var n = s.indexOf("//\n");
    if (n !== 0) return s;
	return s.substr(3); 
};

csApp.getHeading = function(a,key,$scope,defElem) {

	var h = csApp.set($scope,a,key,"");
	if ( !h ) return "";
	// if ( h.toLowerCase().indexOf("script") >= 0 ) return "";
	var st = h.split("!!"); // h4 class="h3" width="23"!!Tehtava 1
	var elem = defElem;
	var val = st[0];
	var attributes = "";
	if ( st.length >= 2 ) { elem = st[0]; val = st[1]; }
	var i = elem.indexOf(' ');
	var ea = [elem];
	if ( i >= 0 ) ea = [elem.substring(0,i),elem.substring(i)];
	// var ea = elem.split(" ",2);
	if ( ea.length > 1 ) { elem = ea[0]; attributes = " " + ea[1] + " "; }
	// if ( elem.toLowerCase().indexOf("script") >= 0 ) return "";
	// attributes = "";  // ei laiteta näitä, niin on vähän turvallisempi
	try {
	  // val = decodeURIComponent(escape(val));
	  val = decodeURIComponent(encodeURI(val));
	} catch(err) {}
    var html = "<" + elem + attributes + ">" + val + "</" + elem + ">";
	html = $sanitize(html);
	return html;
};


csApp.directiveTemplateCS = function(t,isInput) {

	csApp.taunoPHIndex = 3;
    csLogTime("dir templ " + t);
    if ( TESTWITHOUTPLUGINS ) return '';

    if ( t == 'text') {
        return '<div class="csRunDiv csTinyDiv" ng-cloak style="text-align: left;">' +
                '<p>Here comes header</p>' +
    		  '<span ng-if="stem" class="stem"  ng-bind-html="stem"></span>' +
			  '<input class="csTinyText no-popup-menu" ng-hide="noeditor && !viewCode" size="{{cols}}" ng-model="usercode" ng-trim="false" ng-attr-placeholder="{{placeholder}}" ng-keypress="runCodeIfCR($event);" />'+
			  '<button ng-if="isRun"  ng-disabled="isRunning" title="(Ctrl-S)" ng-click="runCode();" ng-bind-html="buttonText"></button>&nbsp&nbsp'+
			  '<a href="" ng-if="muokattu" ng-click="initCode();">{{resetText}}</a>&nbsp&nbsp' +
			  '<pre  class="console ng-hide" ng-show="result" ng-cloak>{{result}}</pre>'+
			  '<span class="csRunError"  ng-if="runError" ng-style="tinyErrorStyle">{{error}}</span>'+
			  '<div  class="htmlresult" ng-if="htmlresult" ><span ng-bind-html="svgImageSnippet()"></span></div>'+
			  '</div>';
    }
    
	return  '<div class="csRunDiv type-{{rtype}}" ng-cloak>' +
    
				  '<p>Here comes header</p>' +
				//  '<p ng-bind-html="getHeader()"></p>
				  '<p ng-if="stem" class="stem" ng-bind-html="stem"></p>' +
  				  (t === "tauno" || t === "simcir" ?
				    '<p ng-if="taunoOn" class="pluginHide""><a ng-click="hideTauno()">{{hideTaunoText}}</a></p>' +
				    '<div ><p></p></div>' + // Tauno code place holder nr 3!!
				    '<p ng-if="!taunoOn" class="pluginShow" ><a ng-click="showTauno()">{{showTaunoText}}</a></p>' +
                    (t === "tauno" ? '<p ng-if="taunoOn" class="pluginHide"" ><a ng-click="copyTauno()">{{copyFromTaunoText}}</a> | <a ng-click="hideTauno()">{{hideTaunoText}}</a></p>' +
				    '<p ng-if="taunoOn" class="taunoOhje">{{taunoOhjeText}}</a></p>' 
                    : '<p ng-if="taunoOn && !noeditor" class="pluginHide"" ><a ng-click="copyFromSimcir()">copy from SimCir</a> | <a ng-click="copyToSimcir()">copy to SimCir</a> | <a ng-click="hideTauno()">hide SimCir</a></p>') +
					"" : "") +   
                  '<div ng-if="upload" class="form-inline small">' +  
                  '<div class="form-group small">' +
                  '    {{uploadstem}}: <input type="file" ngf-select="onFileSelect($file)" >' +
                  '            <span ng-show="file.progress >= 0 && !file.error"' +
                  '                  ng-bind="file.progress < 100 ? \'Uploading... \' + file.progress + \'%\' : \'Done!\'"></span>' +
                  '</div>' +
                  '    <div class="error" ng-show="file.error" ng-bind="file.error"></div>' +
                  '    <div  class="úploadresult" ng-if="uploadresult"  ><span ng-bind-html="uploadresult"></span></div>' +
                  '</div>' +
                  '<div ng-show="isAll" style="float: right;">{{languageText}} '+
                    '<select ng-model="selectedLanguage" ng-required ng-init="progLanguag=\'java\'">'+
                      '<option ng-repeat="item in progLanguages" value="{{item}}">{{item}}</option>'+
                    '</select>'+
                  '</div>'+  
				  '<pre ng-if="viewCode && codeover">{{code}}</pre>'+
				  '<div class="csRunCode">'+
                  // '<p></p>'+
				  '<pre class="csRunPre" ng-if="viewCode &&!codeunder &&!codeover">{{precode}}</pre>'+
                  '<div class="csEditorAreaDiv">'+
                  '<div  class="csrunEditorDiv">'+
				  '<textarea class="csRunArea csEditArea no-popup-menu" ng-hide="noeditor && !viewCode" rows="{{rows}}" ng-model="usercode" ng-trim="false" ng-attr-placeholder="{{placeholder}}"></textarea>'+
                  '</div>'+
                  // (t=="sage" ? '</div>' : '') +

				  '<div class="csRunChanged" ng-if="usercode!=byCode"></div>'+
				  //'<div class="csRunChanged" ng-if="muokattu"></div>'+
                  '</div>'+
				  //'<div class="csRunArea" contentEditable ng-model="usercode" ng-trim="false" "></div>'+
				  '<pre class="csRunPost" ng-if="viewCode &&!codeunder &&!codeover">{{postcode}}</pre>'+
				  '</div>'+
				  //'<br />'+ 
                  (t=="sage" ? '<div class="computeSage no-popup-menu"></div>' : '')+
                  
                  (isInput  ?
                  '<div class="csInputDiv" ng-hide="!showInput">' +
                  '<p ng-show="inputstem" class="stem" >{{inputstem}}</p>' +
                  '<div class="csRunCode" >' +
				  '<textarea class="csRunArea csInputArea"  rows={{inputrows}} ng-model="userinput" ng-trim="false" placeholder="{{inputplaceholder}}"></textarea>'+
                  '</div>' + 
                  '</div>' + 
                  '<div class="csArgsDiv" ng-hide="!showArgs">' +
				  '<label>{{argsstem}} </label><span><input type ="text" class="csArgsArea" ng-model="userargs" ng-trim="false" placeholder="{{argsplaceholder}}"></span>'+
                  '</div>' +
                  ''
                  : "") + // end of isInput
                  
                  
				  '<p class="csRunSnippets" ng-if="buttons">' + // && viewCode">' +
				  '<button ng-repeat="item in buttons" ng-click="addText(item);">{{addTextHtml(item)}}</button> &nbsp;&nbsp;' +
                  '</p>' +
                  '<div class="csRunMenuArea" ng-if="!forcedupload">'+
				  '<p class="csRunMenu" >' +
				  '<button ng-if="isRun"  ng-disabled="isRunning" title="(Ctrl-S)" ng-click="runCode();" ng-bind-html="buttonText"></button>&nbsp&nbsp'+
				  '<button ng-if="isTest" ng-disabled="isRunning" ng-click="runTest();">Test</button>&nbsp&nbsp'+
				  '<button ng-if="isUnitTest" ng-disabled="isRunning" ng-click="runUnitTest();">UTest</button>&nbsp&nbsp'+
				  '<span ng-if="isDocument"><a href="" ng-disabled="isRunning" ng-click="runDocument();">{{docLink}}</a>&nbsp&nbsp</span>'+
				  '<a href="" ng-if="!nocode && (file || attrs.program)" ng-click="showCode();">{{showCodeLink}}</a>&nbsp&nbsp'+
				  '<a href="" ng-if="muokattu" ng-click="initCode();">{{resetText}}</a>' +
				  ' <a href="" ng-if="toggleEditor" ng-click="hideShowEditor();">{{toggleEditorText[noeditor?0:1]}}</a>' +
				  ' <a href="" ng-if="!noeditor" ng-click="showOtherEditor();">{{editorText[editorModeIndecies[editorMode+1]]}}</a>' +
                  ' <span ng-if="wrap.n!=-1" class="inputSmall" style="float: right;"><label title="Put 0 to no wrap">wrap: <input type="text"  ng-pattern="/[-0-9]*/" ng-model="wrap.n" size="2" /></label></span>' +
                  '</p>'+
                  '</div>'+
                  (t=="sage" ? '<div class="outputSage no-popup-menu"></div>' :"")+ 

				  '<pre ng-if="viewCode && codeunder">{{code}}</pre>'+
				  (t === "comtest" || t === "tauno" || t === "parsons" || true ? '<p class="unitTestGreen"  ng-if="runTestGreen" >&nbsp;ok</p>' : "") +
				  (t === "comtest" || t === "tauno" || t === "parsons" || true ? '<pre class="unitTestRed"    ng-if="runTestRed">{{comtestError}}</pre>' : "") +
				  // '<p>{{resImage}}</p>'+
				  // '<p>Testi valituksesta</p>' +
				  '<pre class="csRunError" ng-if="runError">{{error}}</pre>'+
				  '<pre  class="console ng-hide" ng-show="result" ng-cloak>{{result}}</pre>'+
				  '<div  class="htmlresult" ng-if="htmlresult" ><span ng-bind-html="svgImageSnippet()"></span></div>'+
				  //'<div  class="userlist" tim-draggable-fixed style="top: 39px; right: 408px;"><span>Raahattava</span>'+
				  '<span  class="csrunPreview"></span>'+
                  //'</div>'+
                  // '<div class="previewcontent"></div>' +
                  
                  //'<div  class="htmlresult" ng-if="htmlresult" ><span ng-bind-html="htmlresult"></span></div>'+
				  //'<div  class="htmlresult" ng-if="htmlresult" >{{htmlresult}}</span></div>'+
                  
				  (t === "jypeli" || true ? '<img ng-if="imgURL" class="grconsole" ng-src="{{imgURL}}" alt=""  />' +
                         '<video ng-if="wavURL" ng-src="{{wavURL}}" type="video/mp4" controls="" autoplay="true" width="300" height="40"></video>'
                      : "") +
				  // '<a ng-if="docURL" class="docurl" href="{{docURL}}" target="csdocument" >Go to document</a>' +
				  '<div ng-if="docURL" class="docurl">'+
				  '<p align="right" style="position: absolute; margin-left: 790px;"><a ng-click="closeDocument()" >X</a></p>' +
				  '<iframe width="800" height="600"  ng-src="{{docURL}}" target="csdocument" allowfullscreen/>' +
				  '</div>' +
				  //(t == "jypeli" ? '<img  class="grconsole" ng-src="{{imgURL}}" alt=""  ng-if="runSuccess"  />' : "") +
                  //  '<div class="userlist" tim-draggable-fixed="" style="top: 39px; right: 408px;">' +
                  //  'Raahattava' +
                  //  '</div>' +  
				  '<p class="plgfooter">Here comes footer</p>'+
                  //'<p ng-show="logTime()"></p>'+
				  '</div>';
};


csApp.set = function(scope,attrs,name,def) {

    scope[name] = def;
    if ( attrs && attrs[name] ) scope[name] = attrs[name];
    if ( scope.attrs && scope.attrs[name] ) scope[name] = scope.attrs[name];
    if ( scope[name] === "None" ) scope[name] = "";
    if ( scope[name] === "False" ) scope[name] = false;
    return scope[name];
};


csApp.getParam = function(scope,name,def) {

    var result = def;
    if ( scope.attrs && scope.attrs[name] ) result = scope.attrs[name];
    if ( scope[name] ) result = scope[name];
    if ( result === "None" ) result = "";
    if ( result === "False" ) result = false;
    return result;
}

csApp.directiveFunction = function(t,isInput) {

	return {
		link: function (scope, element, attrs) {
            if ( TESTWITHOUTPLUGINS ) return;

            scope.cursor = "\u0383"; //"\u0347"; // "\u02FD";
			scope.taunoHtml = element[0].childNodes[csApp.taunoPHIndex]; // Check this carefully, where is Tauno placeholder
            scope.plugin = element.parent().attr("data-plugin");
            scope.taskId  = element.parent().attr("id");
            scope.isFirst = true;
            scope.element = element;
            if ( scope.$parent.$$prevSibling ) scope.isFirst = false;
            csApp.set(scope,attrs,"lang","fi");
            var english = scope.lang=="en"; 
            scope.english = english;


            if ( (t == "tauno" || t === "simcir") ) { // Tauno translations
                var taunoText = "Tauno";
                if ( t === "simcir" ) taunoText = "SimCir";
                scope.hideTaunoText = (english ? "hide ": "piilota ") + taunoText;
                scope.showTaunoText = (english ? "Click here to show ": "Näytä ") +  taunoText;
                scope.taunoOhjeText = english ? 
                  'Copy the code you made by Tauno by pressing the link "copy from Tauno". Then press Run-button. Note that the running code may have different code than in Tauno!':
                  'Kopioi Taunolla tekemäsi koodi "kopioi Taunosta"-linkkiä painamalla. Sitten paina Aja-painiketta. Huomaa että ajossa voi olla eri taulukko kuin Taunossa!';
                scope.copyFromTaunoText = english ? "copy from Tauno" : "kopioi Taunosta";  
                scope.copyFromSimCirText = english ? "copy from SimCir" : "kopioi SimCiristä";  
                scope.copyToSimCirText = english ? "copy to SimCir" : "kopioi SimCiriin";  
            }
            
            
            scope.languageText = english ? "language: " : "kieli: ";  
            
			csApp.set(scope,attrs,"type","cs");
            var rt = languageTypes.getRunType(scope.type,false);
            var iupload = false;
            var inoeditor = false;
            var inocode = false;
            if ( scope.type === "upload" ) {
                iupload = true;
                inoeditor = true;
                inocode = true;
                scope.forcedupload = true;
            }
            

            scope.isText = rt == "text" || rt == "xml" || rt == "css";
            scope.rtype = rt;
            scope.isSage =  rt == "sage";
            scope.isMathCheck = rt == "mathcheck";
            scope.isSimcir = t === "simcir";
            scope.tiny = scope.type.indexOf("tiny") >= 0;
            var isArgs = scope.type.indexOf("args") >= 0;

			csApp.set(scope,attrs,"file");
			csApp.set(scope,attrs,"viewCode",false);
			csApp.set(scope,attrs,"filename");
			csApp.set(scope,attrs,"nosave",false);
			csApp.set(scope,attrs,"upload",iupload); if ( scope.attrs.uploadbycode ) scope.upload = true;
			csApp.set(scope,attrs,"uploadstem");
			csApp.set(scope,attrs,"nocode",inocode);
			csApp.set(scope,attrs,"lang");
			csApp.set(scope,attrs,"width");
			csApp.set(scope,attrs,"height");
			csApp.set(scope,attrs,"table");
			csApp.set(scope,attrs,"variables");
			csApp.set(scope,attrs,"indices");
			csApp.set(scope,attrs,"replace");
			csApp.set(scope,attrs,"taunotype");
			csApp.set(scope,attrs,"stem");
			csApp.set(scope,attrs,"iframe",false);
            if ( languageTypes.isInArray(rt,["glowscript", "vpython"]) ) { scope.glowscript = true; scope.iframe = true; }
			// csApp.set(scope,attrs,"usercode","");
			csApp.set(scope,attrs,"codeunder",false);
			csApp.set(scope,attrs,"codeover",false);
			csApp.set(scope,attrs,"open",!scope.isFirst);
			csApp.set(scope,attrs,"rows",1);
			csApp.set(scope,attrs,"cols",10);
			csApp.set(scope,attrs,"maxrows",100);
			csApp.set(scope,attrs,"attrs.bycode");
			csApp.set(scope,attrs,"placeholder", scope.tiny ? "" : english ? "Write your code here": "Kirjoita koodi tähän:");
			csApp.set(scope,attrs,"inputplaceholder",english ? "Write your input here": "Kirjoita syöte tähän");
			csApp.set(scope,attrs,"argsplaceholder",scope.isText ? (english ? "Write file name here" : "Kirjoita tiedoston nimi tähän" ) : (english ? "Write your program args here": "Kirjoita ohjelman argumentit tähän"));
			csApp.set(scope,attrs,"argsstem",scope.isText ? (english ? "File name:" : "Tiedoston nimi:") : (english ? "Args:": "Args"));
			csApp.set(scope,attrs,"userinput","");
			csApp.set(scope,attrs,"userargs",scope.isText && isArgs ? scope.filename : "");
			csApp.set(scope,attrs,"selectedLanguage", scope.type);
			csApp.set(scope,attrs,"inputstem","");
			csApp.set(scope,attrs,"inputrows",1);
			csApp.set(scope,attrs,"toggleEditor",scope.isSimcir ? "True" : false);
            csApp.set(scope,attrs,"indent",-1);
            csApp.set(scope,attrs,"user_id");
            csApp.set(scope,attrs,"isHtml",false);
            csApp.set(scope,attrs,"autoupdate",false);
            csApp.set(scope,attrs,"canvasWidth",700);
            csApp.set(scope,attrs,"canvasHeight",300);
            csApp.set(scope,attrs,"button","");
            csApp.set(scope,attrs,"noeditor",scope.isSimcir ? "True" : inoeditor);
            csApp.set(scope,attrs,"norun",false);
            csApp.set(scope,attrs,"normal",english ? "Normal": "Tavallinen");
            csApp.set(scope,attrs,"highlight","Highlight");
            csApp.set(scope,attrs,"parsons","Parsons");
            csApp.set(scope,attrs,"jsparsons","JS-Parsons");
            csApp.set(scope,attrs,"editorMode",-1);
            csApp.set(scope,attrs,"showCodeOn",english ? "Show all code" : "Näytä koko koodi");
            csApp.set(scope,attrs,"showCodeOff",english ? "Hide extra code": "Piilota muu koodi");
            csApp.set(scope,attrs,"resetText", english ? "Reset" : "Alusta");
            csApp.set(scope,attrs,"blind",false);
            csApp.set(scope,attrs,"words",false);
            csApp.set(scope,attrs,"editorModes","01");
            csApp.set(scope,attrs,"justSave",false);
            csApp.set(scope,attrs,"validityCheck","");
            csApp.set(scope,attrs,"validityCheckMessage","");
  			csApp.set(scope,attrs,"savestate");

            csApp.set(scope,attrs,"wrap", scope.isText ? 70 : -1);
            scope.wrap = {n:scope.wrap}; // to avoid child scope problems
            // csApp.set(scope,attrs,"program");


            scope.docLink = "Document";
            scope.editorMode = parseInt(scope.editorMode);
            scope.editorText = [scope.normal,scope.highlight,scope.parsons,scope.jsparsons];
            scope.editorModeIndecies =[];
            for (var i=0; i<scope.editorModes.length; i++) scope.editorModeIndecies.push(parseInt(scope.editorModes[i]));
            scope.editorModeIndecies.push(parseInt(scope.editorModes[0]));
            if ( scope.editorModes.length <= 1 ) scope.editorText = ["","","","","","",""];
            scope.checkEditorModeLocalStorage();
            
            scope.showCodeLink = scope.showCodeOn;
			scope.minRows = csApp.getInt(scope.rows);
			scope.maxRows = csApp.getInt(scope.maxrows);
            
            scope.toggleEditorText = [english ? "Edit": "Muokkaa",english ? "Hide": "Piilota"];

            if ( scope.toggleEditor && scope.toggleEditor != "True" ) scope.toggleEditorText =  scope.toggleEditor.split("|");
            
			csApp.set(scope,attrs,"usercode","");
			if ( scope.usercode === "" && scope.byCode )  {
                scope.usercode = scope.byCode;
                scope.initUserCode = true;
            }    
			scope.usercode = csApp.commentTrim(scope.usercode);
			if (scope.blind) scope.usercode = scope.usercode.replace(/@author.*/,"@author XXXX"); // blind
			scope.byCode = csApp.commentTrim(scope.byCode);
			// scope.usercode = csApp.commentTrim(decodeURIComponent(escape(scope.usercode)));
			// scope.byCode = csApp.commentTrim(decodeURIComponent(escape(scope.byCode)));

            
            if ( scope.usercode ) {
                var rowCount = csApp.countChars(scope.usercode,'\n') + 1;
                if ( scope.maxRows < 0 && scope.maxRows < rowCount ) scope.maxRows = rowCount; 
            } else if ( scope.maxRows < 0 ) scope.maxRows = 10;
            
            scope.isAll  = languageTypes.isAllType(scope.type);
            scope.isRun = (languageTypes.getRunType(scope.type,false) !== false  || scope.isAll ) && scope.norun == false;
            scope.isTest = languageTypes.getTestType(scope.type,scope.selectedLanguage,false) !== false;
            scope.isUnitTest = languageTypes.getUnitTestType(scope.type,scope.selectedLanguage,false) !== false;
            scope.isDocument = (scope.type.indexOf("doc") >= 0);

            scope.showInput = (scope.type.indexOf("input") >= 0);
            scope.showArgs = (scope.type.indexOf("args") >= 0);
            if ( !scope.uploadstem ) scope.uploadstem = english ? "Upload image/file" : "Lataa kuva/tiedosto";
            scope.buttonText = english ? "Run": "Aja";
            if ( scope.type.indexOf("text") >= 0 || scope.isSimcir || scope.justSave ) { // || scope.isSage ) {
                scope.isRun = true;
                scope.buttonText = english ? "Save": "Tallenna";
            }            
            if ( scope.button ) {
                scope.isRun = true;
                scope.buttonText = scope.button;
            }
            
			scope.indent = csApp.getInt(scope.indent);
            if ( scope.indent < 0 )
                if ( scope.file ) scope.indent = 8; else scope.indent = 0;

            
			scope.edit = element.find("textarea")[0]; // angular.element(e); // $("#"+scope.editid);
			scope.preview = element.find(".csrunPreview")[0]; // angular.element(e); // $("#"+scope.editid);

            scope.element0 = element[0];
			element[0].childNodes[0].outerHTML = csApp.getHeading(attrs,"header",scope,"h4");
			var n = element[0].childNodes.length;
			if ( n > 1 ) element[0].childNodes[n-1].outerHTML = csApp.getHeading(attrs,"footer",scope,'p class="footer"');
            scope.muokattu = false; // scope.usercode != scope.byCode;
        //    scope.header = head;
		//	scope.getHeader = function() { return head; };
		//	csApp.updateEditSize(scope);
            if (scope.open && (t == "tauno" || t === "simcir") ) scope.showTauno();

            //attrs.buttons = "$hellobuttons$\nMunOhjelma\n$typebuttons$\n$charbuttons$";
            var b = attrs.buttons || scope.attrs.buttons;
            if ( b ) {
                var helloButtons = 'public \nclass \nHello \n\\n\n{\n}\n'+
                                    'static \nvoid \n Main\n(\n)\n' + 
                                    '        Console.WriteLine(\n"\nworld!\n;\n ';
                var typeButtons =  'bool \nchar\n int \ndouble \nstring \nStringBuilder \nPhyscisObject \n[] \nreturn \n, ';
                var charButtons = 'a\nb\nc\nd\ne\ni\nj\n.\n0\n1\n2\n3\n4\n5\nfalse\ntrue\nnull\n=';
                // var b = attrs.buttons;
                b = b.replace('$hellobuttons$', helloButtons);
                b = b.replace('$typebuttons$' , typeButtons);
                b = b.replace('$charbuttons$' , charButtons);
                b = b.trim();
                b = b.replace('$space$' , " ");
                scope.buttons = b.split("\n");
            }
            
            
            if ( scope.isAll ) {
                var langs = attrs.languages || scope.attrs.languages;
                if ( langs ) scope.progLanguages = langs.split(/[\n;\/]/);
                else scope.progLanguages = languageTypes.runTypes;
            }
            
            
            /*
            var editArea = element[0].getElementsByClassName('csEditArea');
            var editor = ace.edit(editArea);
            editor.setTheme("ace/theme/monokai");
            editor.getSession().setMode("ace/mode/javascript");
            */
            //scope.out = element[0].getElementsByClassName('console');
            if ( scope.attrs.autorun ) scope.runCodeLink(true);
            scope.editorIndex = 0;
            if ( scope.editorMode != 0 || scope.editorModes !== "01" ) scope.showOtherEditor(scope.editorMode);
            scope.mode = languageTypes.getAceModeType(scope.type,"");
            
            var styleArgs = csApp.getParam(scope,"style-args","");
            if ( styleArgs ) {
                var argsEdit = element[0].getElementsByClassName("csArgsArea"); // element.find("csArgsArea")[0]
                if ( argsEdit.length > 0  )  argsEdit[0].setAttribute('style',styleArgs);
            }
            
            scope.changeCodeLink();
            scope.processPluginMath();

            csLogTime(scope.taskId);
            
            scope.showUploaded(scope.attrs.uploadedFile,scope.attrs.uploadedType);
            
            // if ( scope.isSage ) alustaSage(scope);
            /*
            scope.element0.keydown(function (e) {
                  if (e.ctrlKey) {
                       if (e.keyCode === 0x53) {
                           if (!scope.isRunning) scope.runCode();
                       }
                  }
            });
            */
            scope.initEditorKeyBindings();
            $(element[0]).bind('keydown', function(event) {
                if (event.ctrlKey || event.metaKey) {
                    switch (String.fromCharCode(event.which).toLowerCase()) {
                    case 's':
                        event.preventDefault();
                        if ( scope.isRun ) scope.runCode();
                        break;
                    }
                }
            });
            
		},		
		scope: {},				 
		controller: csApp.Controller,
		restrict: 'AE',
		/*
		compile: function(tElement, attrs) {
			var content = tElement.children();
		},
		*/
		transclude: true,
		replace: 'true',
		template: csApp.directiveTemplateCS(t,isInput)
		// templateUrl: 'csTempl.html'
	}; 
};

function insertAtCaret(txtarea,text) {
    const doc = document as any;
    var scrollPos = txtarea.scrollTop;
    var strPos = 0;
    var br = ((txtarea.selectionStart || txtarea.selectionStart == '0') ? 
        "ff" : (doc.selection ? "ie" : false ) );
    if (br == "ie") { 
        txtarea.focus();
        var range = doc.selection.createRange();
        range.moveStart ('character', -txtarea.value.length);
        strPos = range.text.length;
    }
    else if (br == "ff") strPos = txtarea.selectionStart;

    var front = (txtarea.value).substring(0,strPos);  
    var back = (txtarea.value).substring(strPos,txtarea.value.length); 
    txtarea.value=front+text+back;
    strPos = strPos + text.length;
    if (br == "ie") { 
        txtarea.focus();
        var range = doc.selection.createRange();
        range.moveStart ('character', -txtarea.value.length);
        range.moveStart ('character', strPos);
        range.moveEnd ('character', 0);
        range.select();
    }
    else if (br == "ff") {
        txtarea.selectionStart = strPos;
        txtarea.selectionEnd = strPos;
        txtarea.focus();
    }
    txtarea.scrollTop = scrollPos;
}

var mathcheckLoaded = false;

function lataaMathcheck(scope, readyFunction) {
    if ( mathcheckLoaded ) { readyFunction(scope); return; }
    var mathcheckLoading = $.ajax({
        dataType: "script",
        cache: true,
        url: "//cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.1/MathJax.js?config=AM_HTMLorMML"
    });
    mathcheckLoading.done(function() {
        mathcheckLoaded = true;
        readyFunction(scope)
    });
    return mathcheckLoading;
}

function runSage(scope) {
    if ( scope.sageButton ) scope.sageButton.click();
}

async function alustaSage(scope,firstTime) {
// TODO: lisää kentätkin vasta kun 1. kerran alustetaan.
// TODO: kielien valinnan tallentaminen
// TODO: kielien valinta kunnolla float.  
// ks: https://github.com/sagemath/sagecell/blob/master/doc/embedding.rst  
    let sagecell = await lazyLoad<Sagecell>("sagecell");
    if ( scope.sagecellInfo ) {
        scope.sagecellInfo.editor = "textarea";
        //scope.sagecellInfo.inputLocation = null;
        //scope.sagecellInfo.outputLocation = null;
        //sagecell.deleteSagecell(scope.sagecellInfo);
        //scope.sagecellInfo = null;
    }        
    var types = scope.type.split("/");
    var languages = sagecell.allLanguages;
    if ( types.length > 1 ) languages = types.slice(1); 
    // if ( scope.sagecellInfo ) {
    if ( scope.sageInput ) {
        var outputLocation = $(scope.sageOutput);
        outputLocation.find(".sagecell_output_elements").hide();
        // scope.sagecellInfo.code = scope.usercode;
        // scope.sagecellInfo.code = scope.getReplacedCode();
        // scope.sagecellInfo.session.code = scope.sagecellInfo.code;
        // scope.sagecellInfo.inputLocation.innerText = scope.sagecellInfo.code;
        //scope.sagecellInfo.inputLocation.children[0].children[0].children[0].value = scope.sagecellInfo.code;
        scope.sageInput.value = scope.getReplacedCode();
        return;
    }    
    scope.sageArea = scope.element0.getElementsByClassName('computeSage')[0];                    
    scope.editArea = scope.element0.getElementsByClassName('csEditArea')[0];                    
    scope.sageOutput = scope.element0.getElementsByClassName('outputSage')[0];                    
    
    scope.sagecellInfo = sagecell.makeSagecell({
        inputLocation: scope.sageArea,
        replaceOutput: true,
        //inputLocation: scope.editArea,
        editor: "textarea",
        // hide: ["evalButton"],
        hide: ["editor","evalButton"],
        outputLocation: scope.sageOutput,
        requires_tos: false,
        // code: scope.usercode,
        code: scope.getReplacedCode(),
        getCode: function() { 
          return scope.getReplacedCode(); 
        },
        autoeval: scope.attrs.autorun || firstTime,
        callback: function() {
            scope.sageButton = scope.sageArea.getElementsByClassName("sagecell_evalButton")[0]; // .button();     
            scope.sageInput = scope.sageArea.getElementsByClassName("sagecell_commands")[0]; 
            
            scope.sageButton.onclick = function() {
                // scope.checkSageSave();
                scope.sagecellInfo.code = scope.getReplacedCode();
                // scope.sagecellInfo.session.code = scope.sagecellInfo.code;
            };
            var sagecellOptions = scope.element0.getElementsByClassName('sagecell_options')[0];  
            var csRunMenuArea = scope.element0.getElementsByClassName('csRunMenuArea')[0];
            if ( csRunMenuArea && sagecellOptions ) csRunMenuArea.appendChild(sagecellOptions);
            sagecellOptions.style.marginTop = "-2em";
        },
        languages: languages // sagecell.allLanguages
    });

}    

csApp.getInt = function(s) {

   var n = parseInt(s);
   if ( isNaN(n) ) return 0;
   return n;
};


csApp.countChars = function (s,c) {

	var n = 0;
	for (var i=0; i<s.length; n += +(c===s[i++]));
	return n;
};


csApp.updateEditSize = function(scope) {

//return;
    if ( !scope ) return;
	if ( !scope.usercode ) return;
    var n = csApp.countChars(scope.usercode,'\n') + 1;
	if ( n < scope.minRows ) n = scope.minRows;
	if ( n > scope.maxRows ) n = scope.maxRows;
	if ( n < 1 ) n = 1;
	scope.rows = n;
};

csApp.ifIs = function(value,name,def) {

	if ( !value && !def ) return "";
	if ( !value  ) return name+'="'+def+'" ';
	return name+'="'+value+'" ';
};
		
csApp.doVariables = function(v,name) {

	if ( !v ) return "";
	var r = "";
	var va = v.split(";");  
	for ( var n in va ) {
        if ( va.hasOwnProperty(n)) {
            var nv = va[n].trim();
            if (nv) {
                r += name + nv + "&";
            }
        }
	}
	return r.replace(/ /g,"");
};


csApp.Hex2Str = function (s) {

  var result = '';
  for (var i=0; i<s.length; i+=2) {
    var c = String.fromCharCode(parseInt(s[i]+s[i+1],16));
    result += c;
  }
  return result;
};


csApp.Controller = function($scope,$transclude) {

    csLogTime("controller");
	$scope.wavURL = "";
	$scope.byCode ="";
	$scope.attrs = {} as any;
    $scope.svgImageSnippet = function() {
        var s = $sce.trustAsHtml($scope.htmlresult); 
        return s;
        // return $scope.htmlresult;
    };

	$transclude(function(clone, scope) {
        if ( TESTWITHOUTPLUGINS ) return;
		if ( !clone[0] ) return;
		try {
            var markJSON = "xxxJSONxxx";
            var markHex = "xxxHEXJSONxxx";
            var s = "";
            for (var i=0; i< clone.length; i++)
                 s += clone[i].textContent;
            var chex = s.indexOf(markHex) === 0;
            var cjson = s.indexOf(markJSON) === 0;
            if (!chex && !cjson) {
                $scope.byCode = s;
                return;
            }
            if (cjson) s = s.substring(markJSON.length);
            if (chex) s = csApp.Hex2Str(s.substring(markHex.length));
            $scope.attrs = JSON.parse(s);
            $scope.byCode = $scope.attrs.by || $scope.attrs.byCode;
        } catch (err ) {
		    console.log(err);
        }
	});
	$scope.errors = [];
	$scope.taunoOn = false;
	// $scope.replace = "INSERT YOUR CODE HERE";
	// $scope.file = "https://svn.cc.jyu.fi/srv/svn/ohj1/luentomonistecs/esimerkit/Pohja/Jypeli/Jypeli.cs";
	$scope.result = "";
	$scope.htmlresult = "";
	$scope.resImage = "";
	$scope.imgURL = "";
	$scope.viewCode = false;
	$scope.runSuccess = false;
	$scope.copyingFromTauno = false;
    
    $scope.onFileSelect = function (file) {
        // if (!touchDevice) $scope.editor.focus();
        $scope.ufile = file;
        console.log(file);

        if (file) {
            if ( $scope.attrs.uploadbycode ) {
                console.log("bycode");
                var reader = new FileReader();
                reader.onload = (function(e) {
                    // showTrack(theFile.target.result,type);  
                    // console.log(theFile.target.result);
                    $scope.usercode = reader.result;
                  });
                reader.readAsText(file);  

                return;
            }
            
            
            
            $scope.ufile.progress = 0;
            $scope.ufile.error = null;
            $scope.uploadedFile = null;
            $scope.uploadresult = null;
            $scope.docURL = null;
            var ti = $scope.taskId.split(".");
            if ( ti.length < 2 ) return;
            file.upload = $upload.upload({
                url: '/pluginUpload/' + ti[0] + '/' + ti[1] + '/' + $scope.user_id + '/',
                data: {
                    file: file
                },
                method: 'POST'
            });

            file.upload.then(function (response) {
                $timeout(function () {
                    $scope.showUploaded(response.data.file, response.data.type);
                    $scope.doRunCode('upload',false);
                });
            }, function (response) {
                if (response.status > 0) 
                    $scope.ufile.error = response.data.error;
            }, function (evt) {
                    $scope.ufile.progress = Math.min(100, Math.floor(100.0 *
                    evt.loaded / evt.total));
            });

            file.upload.finally(function () {
            })
        }
    };


    $scope.processPluginMath = function() {
        if ( !$scope.isMathCheck ) return;
        lataaMathcheck($scope, function(sc) {
            $timeout(function () {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, $scope.element[0]]);
            },  0);
        });
    }
    
    $scope.showUploaded = function(file,type) {
        if ( !file || !type ) return;
        $scope.uploadedFile = file;
        $scope.uploadedType = type;
        var name = uploadFileTypes.name(file);
        var html = '<p class="smalllink"><a href="' + file +'" title="'+ type +'">' + name + '</a></p>'; // (' + type + ')</p>';
        if (type.indexOf("image") == 0) {
            html += '<img src="'+$scope.uploadedFile+'"/>';
            $scope.uploadresult = $sce.trustAsHtml(html);
            return;
        }
        if (type.indexOf("video") == 0) {
            html += '<video src="'+$scope.uploadedFile+'" controls/>';
            $scope.uploadresult = $sce.trustAsHtml(html);
            return;
        }
        if (type.indexOf("audio") == 0) {
            html += '<audio src="'+$scope.uploadedFile+'" controls/>';
            $scope.uploadresult = $sce.trustAsHtml(html);
            return;
        }
        if ( type.indexOf("text") == 0 ) {
            html += '<div style="overflow: auto; -webkit-overflow-scrolling: touch; max-height:900px; -webkit-box-pack: center; -webkit-box-align: center; display: -webkit-box;"  width:1200px>';
            html += '<iframe  width="800" src="' + file +'" target="csdocument" allowfullscreen  onload="resizeIframe(this)" />';
            html += '</div>';
			$scope.uploadresult = $sce.trustAsHtml(html);
			return;

        }

        if ( uploadFileTypes.is(uploadFileTypes.show, file)) {
            html += '<div style="overflow: auto; -webkit-overflow-scrolling: touch; max-height:1200px; -webkit-box-pack: center; -webkit-box-align: center; display: -webkit-box;"  width:1200px>';
            html += '<iframe width="800" height="900"  src="' + file +'" target="csdocument" allowfullscreen onload="resizeIframe(this)" />';
            //html += '<embed  width="800" height="16000"  src="' + file +'" />';
            //html += '<object width="800" height="600"   data="' + file +'" type="' + type +'"  ></object>';
            html += '</div>';
			$scope.uploadresult = $sce.trustAsHtml(html);
			return;
        }

        var html = '<p></p><p>Ladattu: <a href="' + file +'" title="'+ type +'">' + name + '</a></p>';
        $scope.uploadresult = $sce.trustAsHtml(html);
        return;
    }
    



    $scope.checkWrap = function() {
        var r = wrapText($scope.usercode, $scope.wrap.n);
        if ( r.modified ) {
            if ( $scope.editorIndex === 0) {
                var start = $scope.edit.selectionStart;

                //$scope.usercode = lines.join("\n");
                $scope.edit.value = r.s;
                $scope.edit.selectionStart = start;
                $scope.edit.selectionEnd = start;
            }
            if ( $scope.editorIndex === 1) { // ACE
                var editor = $scope.aceEditor;
                // var start = $scope.aceEditor.selectionStart;
                var cursor = editor.selection.getCursor();
                var index = editor.session.doc.positionToIndex(cursor, 0);
                //$scope.usercode = lines.join("\n");
                editor.setValue(r.s);
                cursor = editor.session.doc.indexToPosition(index, 0);
                editor.selection.moveCursorToPosition(cursor);
                editor.selection.clearSelection();
            }

        }

    }

	$scope.$watch('usercode', function() {
		if ( !$scope.copyingFromTauno && $scope.usercode !== $scope.byCode ) $scope.muokattu = true;
		$scope.copyingFromTauno = false;
		if ( $scope.minRows < $scope.maxRows ) 
			csApp.updateEditSize($scope);
		if ( $scope.viewCode ) $scope.pushShowCodeNow();
        if ( $scope.wrap.n > 0 ) $scope.checkWrap();
        window.clearInterval($scope.runTimer);
        if ( $scope.runned && $scope.autoupdate ) $scope.runTimer = setInterval($scope.runCodeAuto,$scope.autoupdate);

		/* // tällä koodilla on se vika, että ei voi pyyhkiä alusta välilyönteä ja yhdistää rivejä
		if ( $scope.carretPos && $scope.carretPos >= 0 ) {
		    $scope.edit.selectionStart = $scope.carretPos;
		    $scope.edit.selectionEnd = $scope.carretPos;
		    $scope.carretPos = -1;
		}
		else $scope.checkIndent(); // ongelmia saada kursori paikalleen
		*/
	}, true);

    
	$scope.$watch('userargs', function() {
        window.clearInterval($scope.runTimer);
        if ( $scope.runned && $scope.autoupdate ) $scope.runTimer = setInterval($scope.runCodeAuto,$scope.autoupdate);
	}, true);
    
	$scope.$watch('userinput', function() {
        window.clearInterval($scope.runTimer);
        if ( $scope.runned && $scope.autoupdate ) $scope.runTimer = setInterval($scope.runCodeAuto,$scope.autoupdate);
	}, true);
    
    $scope.logTime = function(msg) {
        csLogTime(msg + " " + $scope.taskId);
        return true;
    }
    
    $scope.runCodeIfCR = function(event) {
        $scope.runError ="";
        if ( event.keyCode == 13 ) $scope.runCode();
    }

    $scope.runCodeCommon = function(nosave, extraMarkUp)
    {
        $scope.runned = true;
		var t = languageTypes.getRunType($scope.selectedLanguage,"cs") as string;
        if ( t == "md" ) { $scope.showMD(); if (nosave || $scope.nosave) return; }
        if ( languageTypes.isInArray(t, csJSTypes ) ) { $scope.jstype = t; $scope.showJS(); if (nosave || $scope.nosave) return; } 
		$scope.doRunCode(t,nosave || $scope.nosave);
    }
    
    $scope.runCodeAuto = function() {
        window.clearInterval($scope.runTimer);
		$scope.runCodeCommon(true);
	};
	
	$scope.runCodeLink = function(nosave) {
		$scope.runCodeCommon(nosave || $scope.nosave);
	};
	
	$scope.runCode = function() {
		$scope.runCodeCommon(false);
	};
	
	$scope.runTest = function() {
		var t = languageTypes.getTestType($scope.type,$scope.selectedLanguage,"comtest") as string;
		$scope.doRunCode(t,false);
	};
	
	$scope.runUnitTest = function() {
		var t = languageTypes.getUnitTestType($scope.type,$scope.selectedLanguage,"junit") as string;
		$scope.doRunCode(t,false);
	};
	
    
    
	$scope.runDocument = function() {
	    if ( $scope.docURL ) {
	        $scope.closeDocument();
            $scope.docLink = "Document";
	        return;
	    }
        $scope.docLink ="Hide document";
		var t = languageTypes.getRunType($scope.selectedLanguage,"cs") as string;
		$scope.doRunCode(t, false, {"document": true});
	};


	$scope.closeDocument = function() {
		$scope.docURL = "";
	};


    $scope.hideShowEditor = function() {
        $scope.noeditor = !$scope.noeditor;
    };
    
    /*
    $scope.sageCode = function() {
        if ( !$scope.sagecellInfo ) return false;
        if ( !$scope.sagecellInfo.inputLocation ) return false;
        if ( !$scope.sagecellInfo.inputLocation.sagecell_session ) return false;
        if ( !$scope.sagecellInfo.inputLocation.sagecell_session.code ) return false;     
        return $scope.sagecellInfo.inputLocation.sagecell_session.code;
    }
    
	$scope.checkSageSave = function() {
        window.clearInterval($scope.sageTimer);
        // if ( $scope.autoupdate ) 
        $scope.sageTimer = setInterval(
           function() {
                var sg = $scope.sageCode();
                if ( !sg ) return;
                window.clearInterval($scope.sageTimer);
                if ( sg === $scope.usercode ) return; // Automatic does not save if not changed
                $scope.doRunCode("sage",false);
           },500);    
    }
    */
    

    
	$scope.doRunCode = async function(runType, nosave, extraMarkUp) {
		// $scope.viewCode = false;
        window.clearInterval($scope.runTimer);
        $scope.closeDocument();
        // alert("moi");
        
        if ( $scope.isSage ) {
            await alustaSage($scope, true);
            runSage($scope);
            /*
            var sageLoading = alustaSage($scope,true);
            if ( $scope.sageButton ) {
                sageLoading.done(function() {$scope.sageButton.click();});
            }
            */
        }
        // if ( $scope.isSage && !$scope.sagecellInfo ) alustaSage($scope,true);
        
        if ( $scope.simcir ) {
            $scope.usercode = await $scope.getCircuitData();
        }
		else if ( $scope.taunoOn && ( !$scope.muokattu || !$scope.usercode ) ) $scope.copyTauno();
        
        if ( $scope.parson ) {
            var fb = $scope.parson.getFeedback();
            $scope.usercode = $scope.getJsParsonsCode();
        }
        
        if ( $scope.csparson ) {
            // var fb = $scope.parson.getFeedback();
            $scope.usercode = $scope.csparson.join("\n");
            $scope.csparson.check($scope.usercode);
        }
        
        // if ( runType == "md" ) { $scope.showMD(); return; }
		$scope.checkIndent();
		if ( !$scope.autoupdate ) {
            $scope.tinyErrorStyle = {};
            $scope.error = "... running ...";
            $scope.runError = true;
            $scope.isRunning = true;
        }
		$scope.resImage = "";
		$scope.imgURL = "";
		$scope.wavURL = "";
		$scope.runSuccess = false;
		if ( !languageTypes.isInArray(runType, csJSTypes ) ) $scope.result = "";
		$scope.runTestGreen = false;
		$scope.runTestRed = false;
        var isInput = false;
        if ( $scope.type.indexOf("input") >= 0 ) isInput = true;

        var ucode = "";
        var uinput = "";
        var uargs = "";
        if ( $scope.usercode ) ucode = $scope.usercode.replace($scope.cursor,"");
        ucode = ucode.replace(/\r/g,"");
        if ( $scope.userinput ) uinput = $scope.userinput;
        if ( $scope.userargs ) uargs = $scope.userargs;
		var t = runType;
		// if ( t == "tauno" ) t = "comtest";
        if ( $scope.validityCheck ) {
            var re = new RegExp($scope.validityCheck);
            if ( !ucode.match(re)) {
                $scope.tinyErrorStyle = {color: "red"};
                var msg = $scope.validityCheckMessage;
                if ( !msg ) msg = "Did not match to " + $scope.validityCheck;
                $scope.error = msg;
                $scope.isRunning = false;
                return;
            }
        }
    
		// params = 'type='+encodeURIComponent($scope.type)+'&file='+encodeURIComponent($scope.file)+ '&replace='+ encodeURIComponent($scope.replace)+ '&by=' + encodeURIComponent($scope.usercode);
		// $http({method: 'POST', url:"http://tim-beta.it.jyu.fi/cs/", data:params, headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
		var params = {
            //   'input': 1
			'input': {
			    'usercode':ucode,
			    'userinput':uinput,
			    'isInput' : isInput,
			    'userargs': uargs,
                'uploadedFile' : $scope.uploadedFile,
                'uploadedType' : $scope.uploadedType,
                'nosave': false,
                // 'markup': {'type':t, 'file': $scope.file, 'replace': $scope.replace, 'lang': $scope.lang, 'taskId': $scope.taskId, 'user_id': $scope.user_id},
				'markup': { 'type': t, 'taskId': $scope.taskId, 'user_id': $scope.user_id }
			}
        };
		//		  alert($scope.usercode);
        if ( nosave  || $scope.nosave) params.input.nosave = true;
        if ( extraMarkUp ) jQuery.extend(params.input.markup, extraMarkUp);
        if ( $scope.isAll ) jQuery.extend(params.input, {'selectedLanguage': $scope.selectedLanguage});
        var url = "/cs/answer";
        // url = "http://tim-beta.it.jyu.fi/cs/answer";
        if ( $scope.plugin ) {
            // url = "/csPlugin" + /*$scope.plugin + */ "/" + $scope.taskId + "/answer/"; // Häck to get same origin
            url = $scope.plugin;
            var i = url.lastIndexOf("/");
            if ( i > 0 ) url = url.substring(i);
            url += "/" + $scope.taskId + "/answer/";  // Häck piti vähän muuttaa, jotta kone häviää.
        }
		$http<{
            web: {
                error?: string,
                pwd?: string,
                image?: string,
                wav?: string,
                testGreen?: boolean,
                testRed?: boolean,
                comtestError?: string,
                docurl?: string,
                console?: string,
            }
        }>({method: 'PUT', url: url, data:params, headers: {'Content-Type': 'application/json'}, timeout: 20000 }
		).then(function(response) {
		    let data = response.data;
			if ( data.web.error && false ) {
				$scope.error = data.web.error;
				//return;
			}
            if ( data.web.pwd ) ConsolePWD.setPWD(data.web.pwd,$scope);
			$scope.error = data.web.error;
			var imgURL = "";
			var wavURL = "";
			$scope.runSuccess = true;
            $scope.isRunning = false;

			$scope.runError = $scope.error; // !$scope.runSuccess;

			imgURL = data.web.image;
            //if ( !imgURL ) imgURL = data.web["-replyImage"];
            $scope.imgURL = data.web["-replyImage"];
            $scope.htmlresult = data.web["-replyHTML"];
			wavURL = data.web.wav;
			if ( data.web.testGreen ) $scope.runTestGreen = true;
			if ( data.web.testRed ) $scope.runTestRed = true;
			$scope.comtestError = data.web.comtestError;
            if ( $scope.runError ) $scope.runTestGreen = false;

			var docURL = data.web.docurl;

			if ( docURL ) {
				$scope.docURL = docURL;
				$scope.error = data.web.console.trim();
			}

            if ( wavURL ) {
                // <video src="https://tim.jyu.fi/csgenerated/vesal/sinewave.wav" type="video/mp4" controls="" autoplay="true" ></video>
				$scope.wavURL = wavURL;
				$scope.result = data.web.console.trim();
            }
            
			if ( imgURL ) {
				// $scope.resImage = '<img src="' + imgURL + ' " alt="Result image" />';
				$scope.imgURL = imgURL;
				$scope.result = data.web.console.trim();
			} else {
				if ( $scope.runSuccess )  
                    if ( $scope.isHtml )
                        $scope.htmlresult = removeXML(data.web.console);
                    else
                        if ( !languageTypes.isInArray(runType, csJSTypes ) ) $scope.result = data.web.console;
				else   
				   $scope.error = data.web.error;
			}
			$scope.processPluginMath();

		}, function(response) {
		    let data = response.data;
            $scope.isRunning = false;
			$scope.errors.push(status);
            $scope.error = "Ikuinen silmukka tai jokin muu vika?";
            // $scope.error = "TIMIssä ongelmia, odota vikaa tutkitaan...";
			if ( data && data.error ) $scope.error = data.error;
		});
	};
	
	$scope.hideTauno = function() {
        if ( $scope.simcir ) {
           $scope.simcir.children().remove();
           $scope.simcir = null;
        }
		$scope.taunoOn = false;
		$scope.taunoHtml.innerHTML = "<p></p>";
	};

	
	$scope.copyTauno = function() {
		var f = document.getElementById($scope.taunoId) as any;
		// var s = $scope.taunoHtml.contentWindow().getUserCodeFromTauno();
		var s = f.contentWindow.getUserCodeFromTauno();
		$scope.copyingFromTauno = true;
        var treplace = $scope.attrs.treplace || "";
        if ( treplace ) {
            var treps = treplace.split("&");
            for (var i = 0; i < treps.length; i++) {
                var reps = (treps[i]+"|").split("|");
                s = s.replace(new RegExp(reps[0],'g'),reps[1]);
                s = s.replace(new RegExp("\n\n",'g'),"\n");
            }
        }
		$scope.usercode = s;
        $scope.checkIndent();
		$scope.muokattu = false;
	};
	
	
	$scope.addText = function (s) {
	    // $scope.usercode += s;
        if ( $scope.noeditor ) {
            $scope.userargs += s + " ";
            return;
        }
	    var tbox = $scope.edit;
	    var i = tbox.selectionStart || 0;
	    var uc = $scope.usercode || "";
	    // $scope.usercode = uc.substring(0, i) + s.replace(/\\n/g,"\n") + uc.substring(i);
	    $scope.usercode = (uc + s.replace(/\\n/g,"\n")).replace($scope.cursor,"")+$scope.cursor;
	    // $scope.insertAtCursor(tbox, s);
	    //tbox.selectionStart += s.length;
	    //tbox.selectionEnd += s.length;
	};

	$scope.addTextHtml = function (s) {
	    var ret = s.trim();
	    if (ret.length === 0) ret = "\u00A0";
	    return ret;
	};


	$scope.insertAtCursor = function(myField, myValue) {
	    //IE support
        const doc = document as any;
	    if (doc.selection) {
	        myField.focus();
	        var sel = doc.selection.createRange();
	        sel.text = myValue;
	    }
	        //MOZILLA and others
	    else if (myField.selectionStart || myField.selectionStart === 0) {
	        var startPos = myField.selectionStart;
	        var endPos = myField.selectionEnd;
	        myField.value = myField.value.substring(0, startPos) +
                myValue +
                myField.value.substring(endPos, myField.value.length);
	    } else {
	        myField.value += myValue;
	    }
	};

    // Returns the visible index for next item and the desired size
    $scope.getVid = function(dw, dh) {
		csApp.taunoNr++;
		var vid = 'tauno'+csApp.taunoNr;
		$scope.taunoId = vid;
        if ( dw === undefined ) dw = "100%"
        if ( dh === undefined ) dh = 500
		var w = csApp.ifIs($scope.width,"width",dw);
		var h = csApp.ifIs($scope.height,"height",dh);
        return {vid:vid,w:w,h:h};
    }

    
    $scope.setCircuitData = async function() {
        var data: {width: any, height: any};
        $scope.runError = false;
        try {
            if ( $scope.usercode ) data = JSON.parse($scope.usercode);
        } catch (err ) {
            $scope.error = err.message;
            $scope.runError = true;
        }
        try {
            var initstr = csApp.getParam($scope,"initSimcir","") as string;
            if ( initstr ) {
                var initdata = JSON.parse(initstr);
                $.extend(data,initdata);
            }    
        } catch (err ) {
            $scope.error = err.message;
            $scope.runError = true;
        }
        
        
        data.width = csApp.getParam($scope,"width",800);
        data.height = csApp.getParam($scope,"height",400);
        $scope.simcir.children().remove();
        let simcir = await loadSimcir();
        simcir.setupSimcir($scope.simcir, data );
    }
    
    
    $scope.getCircuitData = async function() {
        let simcir = await loadSimcir();
        var data = simcir.controller($scope.simcir.find('.simcir-workspace'));
        data = data.data();
        
        var buf = '';
        var print = function(s) {
            buf += s;
        };
        var println = function(s) {
            print(s);
            buf += '\r\n';
        };
        var printArray = function(array) {
            $.each(array, function(i, item) {
              println('    ' + JSON.stringify(item) +
                  (i + 1 < array.length? ',' : '') );
            });
        };
        println('{');
        println('  "devices":[');
        printArray(data.devices);
        println('  ],');
        println('  "connectors":[');
        printArray(data.connectors);
        println('  ]');
        print('}');
        return buf;
        // return JSON.stringify(result);
    }
    
    
    $scope.copyToSimcir = function() {
        $scope.setCircuitData();
    }
    
    
    $scope.copyFromSimcir = async function() {
        $scope.usercode = await $scope.getCircuitData();
    }
    
    
    $scope.showSimcir = function() {
        var v = this.getVid();
        $scope.taunoOn = true;	
        $scope.taunoHtml.innerHTML = "<div id="+v.vid+"></div>";
        var jqTauno = $($scope.taunoHtml);
        $scope.simcir2 = $($scope.taunoHtml.innerHTML);
        $scope.simcir = $("#"+v.vid);
        $scope.simcir = jqTauno.find("#"+v.vid);
        $scope.setCircuitData();
        return true;
    }
    
    
	$scope.showTauno = function () {
        if ( $scope.isSimcir ) return $scope.showSimcir();
	    /* 
		csApp.taunoNr++;
		var vid = 'tauno'+csApp.taunoNr;
		$scope.taunoId = vid;
		var w = csApp.ifIs($scope.width,"width",800);
		var h = csApp.ifIs($scope.height,"height",500);
        */
        var v = this.getVid();
		var p = "";
		var tt = "/cs/tauno/index.html?lang="+$scope.lang+"&";
		if ( $scope.taunotype && $scope.taunotype === "ptauno" ) tt = "/cs/tauno/index.html?lang="+$scope.lang+"&s&";
		var taunoUrl = tt; // +"?"; // t=1,2,3,4,5,6&ma=4&mb=5&ialku=0&iloppu=5";
		var s = $scope.table;
		if ( s && s.length > 0) {
			if ( s[0] === 's' ) p = "ts="+s.substring(1) + "&"; // table it's size param "table: s10"
			else p = "t="+s.trim() + "&";                      // table by it's items
		}
		 
		p += csApp.doVariables($scope.variables,"m");
		p += csApp.doVariables($scope.indices,"i");
		
		taunoUrl = taunoUrl + p;
		$scope.iframe = true;
		if ( $scope.iframe )
			$scope.taunoHtml.innerHTML = 
			// '<p class="pluginHide"" ><a ng-click="hideTauno()">hide Tauno</a></p>' + // ng-click ei toimi..
			'<iframe id="'+v.vid+'" class="showTauno" src="' + taunoUrl + '" ' + v.w + v.h + ' ></iframe>';
			// youtube: <iframe width="480" height="385" src="//www.youtube.com/embed/RwmU0O7hXts" frameborder="0" allowfullscreen></iframe>
		else   
			$scope.taunoHtml.innerHTML = '<div class="taunoNaytto" id="'+v.vid+'" />';
		$scope.taunoOn = true;	
	};
	
	
	$scope.initCode = function() {
		$scope.muokattu = false;
		$scope.usercode = $scope.byCode;
		$scope.resImage = "";
		$scope.imgURL = "";
		$scope.runSuccess = false;
		$scope.runError = false;
		$scope.result = "";
		$scope.viewCode = false;
        if ( $scope.parson || $scope.editorModeIndecies[$scope.editorMode] > 1 ) {
            $scope.initUserCode = true;
            $scope.showOtherEditor($scope.editorMode);
        }
        if ( $scope.isSage ) alustaSage($scope,false);
        if ( $scope.simcir ) $scope.setCircuitData();
	};

	
	$scope.stopShow = function() {
		if (angular.isDefined($scope.stop)) {
			$interval.cancel($scope.stop);
			$scope.stop = undefined;
		}
	};
	
	$scope.pushShowCodeNow = function() {
		if ( !$scope.viewCode ) return;
		$scope.showCodeNow();
        return;
        /*
		$scope.stopShow();
		$scope.stop = $interval(function() {
			$scope.showCodeNow();
		}, 1000,1);
		*/
	};
	
	
    $scope.changeCodeLink = function() {
        if ( $scope.viewCode ) 
            $scope.showCodeLink = $scope.showCodeOff;
        else
            $scope.showCodeLink = $scope.showCodeOn;

    }
    
	$scope.showCode = function() {
		$scope.viewCode = !$scope.viewCode;
        $scope.changeCodeLink();
		$scope.localcode = undefined;
		$scope.showCodeNow();
	};
		
        
    $scope.checkIndent = function() {
        if ( !$scope.indent || !$scope.usercode ) return;
        var start = $scope.edit.selectionStart;
        var spaces = "";
        for (var j1=0; j1<$scope.indent; j1++) spaces += " ";
        var n = 0;
        var len = 0;
		var st = $scope.usercode.split("\n");
        for (var i in st) if ( st.hasOwnProperty(i) ) {
			var s = st[i];
			var l = s.length;
			len += l;
			var j = 0;
			for ( ; j<s.length; j++) if ( s[j] !== " " ) break;
			// if ( s.lastIndexOf(spaces,0) == 0 ) continue;
			if ( j >= spaces.length ) continue;
            if ( s.trim() === "" ) continue; // do not indent empty lines
			s = spaces + s.substring(j);
			var dl = s.length - l;
			if ( len - l < start ) start += dl;
			len += dl;
			st[i] = s;
			n++;
        }
        if ( !n ) return;
        $scope.usercode = st.join("\n");
        // $scope.edit[0].selectionStart = start; // aiheuttaa uuden tapahtuman
        $scope.carretPos = start; // seuraava tapahtuma nappaa tämän ja siirtää vain kursorin.
    };
		
	$scope.getReplacedCode = function() {
		// $scope.code = $scope.localcode;
		if ( !$scope.attrs.program ) { $scope.code = $scope.usercode; return $scope.code; }
		var st = $scope.attrs.program.split("\n");
		var r = "";
		var rp = ["",""]; // alkuosa, loppuosa
		var step = 0;
		var nl = "";
		var nls = "";
        var needReplace = !!$scope.replace;
        var regexp = new RegExp($scope.replace);
		for (var i in st) if ( st.hasOwnProperty(i) ) {
			var s = st[i];
			// if ( s.indexOf($scope.replace) >= 0 ) {
            if ( needReplace && regexp.test(s) ) {
				r += nl + $scope.usercode + "\n";
				if ( step === 0 ) { step++; nls = ""; continue; }
			} else { 
				r += nl + s;
				rp[step] += nls + s;
			}
			nl = nls = "\n";
		}
		$scope.code = r;
        return $scope.code;
    }
        
	$scope.showCodeLocal = function() {
		// $scope.code = $scope.localcode;
		if ( $scope.localcode === "" ) { $scope.code = $scope.usercode; return; }
		var st = $scope.localcode.split("\n");
		var r = "";
		var rp = ["",""]; // alkuosa, loppuosa
		var step = 0;
		var nl = "";
		var nls = "";
        var needReplace = !!$scope.replace;
        var regexp = new RegExp($scope.replace);
		for (var i in st) if ( st.hasOwnProperty(i) ) {
			var s = st[i];
			// if ( s.indexOf($scope.replace) >= 0 ) {
            if ( needReplace && regexp.test(s) ) {
				r += nl + $scope.usercode;
				if ( step === 0 ) { step++; nls = ""; continue; }
			} else { 
				r += nl + s;
				rp[step] += nls + s;
			}
			nl = nls = "\n";
		}
		$scope.code = r;
		$scope.precode = rp[0];
		$scope.postcode = rp[1];
	};
		
		
	$scope.showCodeNow = function() {
	    // var copyEvent = new ClipboardEvent('copy', { dataType: 'text/plain', data: 'kissa' } );
        // document.dispatchEvent(copyEvent);
		if ( !$scope.viewCode ) return;
		if ( angular.isDefined($scope.localcode) ) { $scope.showCodeLocal(); return; } 
		if ( !$scope.file &&!$scope.attrs.program ) { $scope.localcode = ""; $scope.showCodeLocal(); return; }
		
		// params = 'print=1&type='+encodeURIComponent($scope.type)+'&file='+encodeURIComponent($scope.file)+ '&keplace='+ encodeURIComponent($scope.replace)+ '&by=' + encodeURIComponent($scope.usercode);
		var params = $scope.attrs;
		// $http({method: 'POST', url:"http://tim-beta.it.jyu.fi/cs/", data:params, headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
		$http<{msg: string, error: string}>({method: 'POST', url: '/cs/?print=1&replace=', data:params, headers: {'Content-Type': 'application/json'}}
		// $http({method: 'POST', url:"/cs/", data:params, headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
		).then(function(response) {
		    let data = response.data;

		    // Server always seems to give text/plain as result, so prepare for it.
		    if (typeof data === "string") {
		        $scope.localcode = data;
				$scope.showCodeLocal();
            }
			else if (data.msg !== '')
			{
				$scope.localcode = data.msg;
				$scope.showCodeLocal();
			}
			else
			{
				$scope.errors.push(data.error);
			}
		}, function(response) {
		    let status = response.status;
			$scope.errors.push(status);
		});
	};
    
    $scope.lastMD = "";
    
	$scope.showMD = function() {
        if ( !$scope.usercode ) return;
        var text = $scope.usercode.replace($scope.cursor,"");
        if ( text == $scope.lastMD ) return;
        $scope.lastMD = text;
        $scope.previewUrl="/preview/" + $scope.taskId.split(".")[0]; // 12971"
        $http.post<{texts: string | {html: string}[]}>($scope.previewUrl, {
            "text": text
        }).then(function (response) {
            let data = response.data;
            var s  = "";
            var $previewDiv = angular.element($scope.preview); 
            
            if( typeof data.texts === 'string' ) {
                s = data.texts;
            } else {    
                var len = data.texts.length;
                for (var i = 0; i < len; i++) s += data.texts[i].html;
            }    
            // s = '<div class="par"  id="f2AP4FHbBIkB"  t="MHgzMGJlMDIxNw=="  attrs="{}" ng-non-bindable>  <div class=""> <p>Vesa MD 2</p>  </div>    <div class="editline" title="Click to edit this paragraph"></div>    <div class="readline"          title="Click to mark this paragraph as read"></div>     </div>    ';
            s = s.replace(/parContent/,""); // Tämä piti ottaa pois ettei scope pilaannu seuraavaa kertaa varten???
            s = s.replace(/<div class="editline".*<.div>/,"");            
            s = s.replace(/<div class="readline"[\s\S]*?<.div>/,"");            
            var html = $compile(s)($scope as any)
            $previewDiv.empty().append(html);

            ParCompiler.processAllMath($previewDiv);
            //$scope.outofdate = false;
            //$scope.parCount = len;

        }, function (response) {
            let data = response.data;
            $window.alert("Failed to show preview: " + data.error);
        });
    };
    
    
    $scope.getJsParsonsCode = function() {
        /*
        var parson = $scope.parson;
        var elemId = parson.options.sortableId;
        var student_code = parson.normalizeIndents(parson.getModifiedCode("#ul-" + elemId));
        var result = "";
        
        // Find the line objects for the student's code
        for (i = 0; i < student_code.length; i++) {
            var line = parson.getLineById(student_code[i].id);
            result += line.code + "\n";
        }
        return result;
        */
        var gr = new ParsonsWidget._graders.VariableCheckGrader($scope.parson);
        var result = gr._codelinesAsString();
        var len = result.length;
        if ( result[len-1] === "\n" ) result = result.slice(0,-1);
        return result;
    }
    
    $scope.showJsParsons = function(parsonsEditDiv) {
        var v = $scope.parsonsId;
        if ( !v ) { 
            v = this.getVid();;
            $scope.parsonsId = v;
        }    
        parsonsEditDiv.setAttribute('id',v.vid);
        if ( $("#"+v.vid).length == 0 ) {         
           setTimeout(function() { 
             $scope.showJsParsons(parsonsEditDiv); } 
            , 300);
            console.log("wait 300 ms " + v.vid);
            return;
        }   
        var classes = "csrunEditorDiv sortable-code";
        var can_indent = true;
        if ( $scope.words ) {
            classes += " jssortable-words";
            can_indent = false;
            var a = $("#"+v.vid);
        }
        parsonsEditDiv.setAttribute('class',classes);
        // parsonsEditDiv.setAttribute('style',"float: none;");

        
        // parsonsEditDiv.innerHTML = "";
        $scope.parson = new ParsonsWidget({
                'sortableId': v.vid,
                'max_wrong_lines': 1,
                //'prettyPrint': false,
                //'x_indent': 0,
                'can_indent' : can_indent,
                //'vartests': [{initcode: "output = ''", code: "", message: "Testing...", variables: {output: "I am a Java program I am a Java program I am a Java program "}},
                //    ],
                //'grader': ParsonsWidget._graders.LanguageTranslationGrader,
            });
        // $scope.parson.init($scope.byCode,$scope.usercode);
        $scope.parson.init($scope.usercode);
        if ( !$scope.initUserCode )
            $scope.parson.options.permutation = iotaPermutation; 
        $scope.parson.shuffleLines();
    }
    
    $scope.showCsParsons = async function(sortable) {
        const csp = await lazyLoadTS<typeof csparsons>("./cs-parsons/csparsons.js", __moduleName);
        let parson = new csp.CsParsonsWidget({
            'sortable': sortable,
            'words': $scope.words,
            'minWidth': "40px",
            'shuffle' : $scope.initUserCode,
            'styleWords' : csApp.getParam($scope,"style-words","") as string,
            'maxcheck' : csApp.getParam($scope,"parsonsmaxcheck","") as number,
            'notordermatters' : csApp.getParam($scope,"parsonsnotordermatters",false) as boolean,
            'onChange': function(p) {
                var s = p.join("\n");
                $scope.usercode = s; 
                }
            });
        parson.init($scope.byCode,$scope.usercode);
        parson.show();
        $scope.csparson = parson;
    }


    $scope.initEditorKeyBindings = function() {
        var eindex = $scope.editorModeIndecies[$scope.editorMode];
        if ( eindex != 0 ) return;
        $($scope.edit).bind('keydown', function(event) {
            eindex = $scope.editorModeIndecies[$scope.editorMode];
            if ( eindex != 0 ) return;
            if ( $scope.editorMode != 0 ) return;
            if (event.which == 9) {
                event.preventDefault();
                if ( event.shiftKey ) return;
                insertAtCaret($scope.edit, "    ");
                $scope.usercode = $scope.edit.value;
                return;
            }
        });
    }
    
    $scope.checkEditorModeLocalStorage = function() {
        if ( $scope.editorMode >= 0 ) return;
        $scope.editorMode = 0;
        if ( typeof(localStorage) === "undefined" )  return;
        if ( localStorage.editorIndex === "undefined" ) return;
        var eindex = localStorage.editorIndex;
        if ( $scope.editorModes.indexOf("0") < 0 ) return;
        if ( $scope.editorModes.indexOf("1") < 0 ) return;
        for ( var em = 0; em < $scope.editorModeIndecies.length; em++ ) {
            var ein = $scope.editorModeIndecies[em];
            if ( ein == eindex ) { $scope.editorMode = em; break; }
        }
    }
    
    $scope.showOtherEditor = async function(editorMode) {
        if ( $scope.parson ) {
            $scope.usercode = $scope.getJsParsonsCode();
        }
        $scope.parson = null;
        $scope.csparson = null;
        
        var editorHtml = '<textarea class="csRunArea csrunEditorDiv" ng-hide="noeditor" rows={{rows}} ng-model="usercode" ng-trim="false" placeholder="{{placeholder}}"></textarea>';

        var aceHtml = '<div class="no-popup-menu"><div ng-show="mode"' +
        // var aceHtml = '<div ng-show="mode" ui-ace="{  mode: \'{{mode}}\',    require: [\'/static/scripts/bower_components/ace-builds/src-min-noconflict/ext-language_tools.js\'],  advanced: {enableSnippets: true,enableBasicAutocompletion: true,enableLiveAutocompletion: true}}"'+
                   // ' style="left:-6em; height:{{rows*1.17}}em;" class="csRunArea csEditArea" ng-hide="noeditor"  ng-model="usercode" ng-trim="false" placeholder="{{placeholder}}"></div>'+
                   //' style="left:-5px; width: 101% !important;'+
                   ' " class="csRunArea csEditArea csAceEditor" ng-hide="noeditor" ng-trim="false" placeholder="{{placeholder}}"></div>'+
                   /*
                   '<div style="right:0px;">'+
                   '<button ng-click="moveCursor(-1, 0);">&#x21d0;</button>'+
                   '<button ng-click="moveCursor( 0,-1);">&#x21d1;</button>'+
                   '<button ng-click="moveCursor( 1, 0);">&#x21d2;</button>'+
                   '<button ng-click="moveCursor( 0, 1);">&#x21d3;</button>'+
                   '</div>'+
                   */
                   '</div>';
        var parsonsHtml = '<div class="no-popup-menu"></div>';
        var html = [editorHtml,aceHtml,parsonsHtml,parsonsHtml];                    
        $scope.mode = languageTypes.getAceModeType($scope.type,"");
        if (typeof editorMode !== 'undefined') $scope.editorMode = editorMode;
        else $scope.editorMode++; 
        if ( $scope.editorMode >= $scope.editorModeIndecies.length-1 ) $scope.editorMode = 0; 
        var eindex = $scope.editorModeIndecies[$scope.editorMode];
        $scope.editorIndex = eindex;
        var otherEditDiv = $scope.element0.getElementsByClassName('csrunEditorDiv')[0];                    
        var editorDiv: JQuery = angular.element(otherEditDiv);
        $scope.edit = $compile(html[eindex])($scope as any)[0] as HTMLTextAreaElement; // TODO unsafe cast
        // don't set the html immediately in case of Ace to avoid ugly flash because of lazy load
        if ( eindex == 1 ) {
            const ace = (await lazyLoad<typeof acemodule>("tim/ace")).ace;
            editorDiv.empty().append($scope.edit);
            var editor = ace.edit(editorDiv.find('.csAceEditor')[0]);
            $scope.aceLoaded(ace, editor as IAceEditor);
            $scope.aceEditor.getSession().setMode('ace/mode/' + $scope.mode);
            $scope.aceEditor.setOptions({
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,
                maxLines: $scope.maxRows
            });
            $scope.aceEditor.setFontSize(15);
            $scope.aceEditor.getSession().setUseWorker(false); // syntax check away
            $scope.aceEditor.renderer.setScrollMargin(12, 12, 0, 0);
            $scope.aceEditor.getSession().setValue($scope.usercode);
            $scope.aceEditor.getSession().on('change', function () {
                $scope.usercode = $scope.aceEditor.getSession().getValue();
            });
            $scope.$watch('usercode', function (newValue, oldValue) {
                if (newValue === oldValue || $scope.aceEditor.getSession().getValue() === newValue) {
                    return;
                }
                $scope.aceEditor.getSession().setValue(newValue);
            });
        }
        else {
            editorDiv.empty().append($scope.edit);
            if (eindex == 2) $scope.showCsParsons(otherEditDiv.children[0]);
            if (eindex == 3) $scope.showJsParsons(otherEditDiv.children[0]);
        }
        $scope.initEditorKeyBindings();
        if ( typeof(localStorage) !== "undefined" && eindex <= 1) {
            localStorage.editorIndex = eindex;
        }
    };
    
    $scope.moveCursor = function(dx,dy) {
        var p = $scope.aceEditor.getCursorPosition();
        p.row +=  dy;
        p.column += dx;
        $scope.aceEditor.moveCursorToPosition(p);
        
    }
    
     // Runs when editor loads
    $scope.aceLoaded = function(ace, editor){
      $scope.aceEditor = editor;
      console.log('Ace editor loaded successfully');
      var session = editor.getSession();
      session.setUndoManager(new ace.UndoManager());
      // Editor Events
      // _session.on("change", function(){
      //   console.log('[EditorCtrl] Session changed:', _session);
      // });
      // editor.renderer.setShowGutter(false);
    };   
    
    $scope.write = function(s) {
       $scope.result += s;
    }    
      
    $scope.writeln = function(s) {
       $scope.write(s+"\n");
    }    
    
    $scope.canvasConsole = {log: null} as Console;
    $scope.canvasConsole.log = function(s) {
        var res = "", sep = "";
        for (var i=0; i<arguments.length; i++) { res += sep + arguments[i]; sep = " "; }    
        $scope.writeln(res);
    };

    
    
    $scope.toggleFixed = function() {
        if ( $scope.canvas.style["position"] == "fixed" ) {
            $scope.canvas.style["position"] = ""
            $scope.irrotaKiinnita = $scope.english ? "Release" : "Irrota";
        } else {
            $scope.canvas.style["position"] = "fixed"        
            $scope.canvas.style["width"] = "900px";
            $scope.irrotaKiinnita = $scope.english ? "Fix" : "Kiinnitä";
        }
    }

    $scope.getCode = function() {
        if ( $scope.attrs.program && !$scope.codeInitialized ) {
            $scope.localcode = $scope.attrs.program;
            $scope.showCodeLocal();
        }
        $scope.codeInitialized = true;
        var text = $scope.usercode.replace($scope.cursor,"");
        if ( $scope.precode || $scope.postcode ) {
        	text = $scope.precode + "\n" + text + "\n" + $scope.postcode;
        }
        return text;
    }
    
    
    $scope.closeFrame = function() {
        if ( !$scope.canvas ) return;
        $scope.canvas.remove();
        $scope.canvas = null;
        $scope.lastJS = "";
    }
    
   $scope.lastJS = "";
    $scope.iframeClientHeight = -1;
	$scope.showJS = function() {
        var wantsConsole = false;
        if ( $scope.type.indexOf("/c") >= 0 ) wantsConsole = true;
        if ( !$scope.attrs.runeverytime && !$scope.usercode && !$scope.userargs && !$scope.userinput ) return;
        if ( !$scope.canvas ) { // create a canvas on first time
            var html = "";
            var scripts = "";
            $scope.fullhtml = ($scope.attrs.fullhtml||"");
            if ( $scope.fullhtml ) $scope.iframe = true;  // fullhtml allways to iframe
            if ( $scope.type.indexOf("html") >= 0 ) {
                $scope.iframe = true; // html allways iframe
                if ( !$scope.fullhtml ) $scope.fullhtml = "REPLACEBYCODE";

            }  // html allways to iframe
            if ( $scope.type.indexOf("/vis") >= 0 ) {
                $scope.iframe = true;  // visjs allways to iframe
                html =  '<div id="myDiv" class="mydiv" width="800" height="400" ></div>';
                scripts = "https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js";
            }
            if ( $scope.iframe ) {
                var dw,dh;
                var fsrc = "/cs/gethtml/canvas.html";
                if ( $scope.glowscript ) {
                    fsrc = "/cs/gethtml/GlowScript.html" 
                    dh = '430';
                    dw = '800';
                    if ( $scope.type == "glowscript" ) $scope.gsDefaultLanguage = "GlowScript 2.1 JavaScript";
                }
                var v = $scope.getVid(dw,dh);
                $scope.irrotaKiinnita = $scope.english ? "Release" : "Irrota";
                html = ($scope.attrs.html||html);
                html = encodeURI(html);
                var angularElement = '<div tim-draggable-fixed class="no-popup-menu" style="top: 91px; right: 0px; z-index: 20" >'+
                  '<span class="csRunMenu"><div><a href ng-click="toggleFixed()" >{{irrotaKiinnita}}</a><a href ng-click="closeFrame()" style="float: right" >[X]</a></div></span>'+
                    (!$scope.fullhtml ? '<iframe id="'+v.vid+'" class="jsCanvas" src="' + fsrc + '?scripts='+($scope.attrs.scripts||scripts)+'&html='+ html + '" ' + v.w + v.h + ' style="border:0" seamless="seamless" sandbox="allow-scripts allow-same-origin">':
                    '<iframe id="'+v.vid+'" class="jsCanvas"'  + v.w + v.h + ' style="border:0" seamless="seamless" sandbox="allow-scripts allow-same-origin">')+
                  '</iframe>'+
                  '</div>';
                $scope.canvas = angular.element(angularElement)[0] as HTMLCanvasElement; // TODO this seems wrong
                // $scope.canvas = angular.element('<iframe id="'+v.vid+'" class="jsCanvas" src="/cs/gethtml/canvas.html" ' + v.w + v.h + ' style="border:0" seamless="seamless" ></iframe>');
                $scope.iframeLoadTries = 10;
            } else {  
                    $scope.canvas = angular.element(//'<div class="userlist" tim-draggable-fixed="" style="top: 91px; right: -375px;">'+
              '<canvas id="csCanvas" width="'+$scope.canvasWidth+'" height="'+$scope.canvasHeight+'" class="jsCanvas"></canvas>' +
              // '<canvas id="csCanvas" width="'+$scope.canvasWidth+'" height="'+$scope.canvasHeight+'" class="jsCanvas userlist" tim-draggable-fixed="" style="top: 91px; right: -375px;"></canvas>' +
              '')[0] as HTMLCanvasElement; // '</div>');
            }
            var $previewDiv = angular.element($scope.preview);
            //$previewDiv.html($scope.canvas);
            $previewDiv.empty().append($scope.previewIFrame = $compile($scope.canvas)($scope as any));
            //$scope.canvas = $scope.preview.find(".csCanvas")[0];
        }
        var text = $scope.usercode.replace($scope.cursor,"");
        // if ( text == $scope.lastJS && $scope.userargs == $scope.lastUserargs && $scope.userinput == $scope.lastUserinput ) return;
        if ( !$scope.attrs.runeverytime && text == $scope.lastJS && $scope.userargs == $scope.lastUserargs && $scope.userinput == $scope.lastUserinput ) return;
        $scope.lastJS = text;
        $scope.lastUserargs = $scope.userargs;
        $scope.lastUserinput = $scope.userinput;
        
        text = $scope.getCode();
        
        if ( $scope.iframe ) { // in case of iframe, the text is send to iframe
            var f =  document.getElementById($scope.taunoId) as GlowScriptFrame; // but on first time it might be not loaded yet
            // var s = $scope.taunoHtml.contentWindow().getUserCodeFromTauno();
            if ( !f || !f.contentWindow  || (!f.contentWindow.runJavaScript && !$scope.fullhtml) ) {
               $scope.lastJS = ""; 
               $scope.lastUserargs = "";
               $scope.lastUserinput = "";
               $scope.iframeLoadTries--;
               if ( $scope.iframeLoadTries <= 0 ) return;
               setTimeout($scope.showJS, 300);
               console.log("Odotetaan 300 ms");
               return;
            }
            if ( $scope.iframeClientHeight < 0 ) $scope.iframeClientHeight = f.clientHeight;
            if ( $scope.gsDefaultLanguage ) f.contentWindow.setDefLanguage($scope.gsDefaultLanguage);
            if ( $scope.fullhtml ) {
                var fhtml = $scope.fullhtml.replace("REPLACEBYCODE", text);
                f.contentWindow.document.open();
                f.contentWindow.document.write(fhtml);
                f.contentWindow.document.close();
            }
            else {
                var s = f.contentWindow.runJavaScript(text, $scope.userargs, $scope.userinput, wantsConsole);
            }
            if ( f.contentWindow.getConsoleHeight ) {
                var ch = f.contentWindow.getConsoleHeight();
                if (ch < $scope.iframeClientHeight) ch = $scope.iframeClientHeight;
                f.height = "";
                f.height = "" + ch + "px";
            }

            return;
        }
        $scope.error = "";
        $scope.runError = false;
        try {
            var ctx = $scope.canvas.getContext("2d");
            ctx.save();
            $scope.result = "";
            var beforeCode = 'function paint(ctx,out, userargs, userinput, console) { ';
            var afterCode = '\n}\n';
            var a = "";
            var b = "";
            var cons = console;
            if ( wantsConsole ) {
               b = beforeCode;
               a = afterCode; 
               cons = $scope.canvasConsole;
            }

            var paint = new Function("return ("+b+text+a+")")(); 
            if ( !$scope.out ) {
               $scope.out = $scope.element0.getElementsByClassName('console')[0] as any;
               $scope.out.write = $scope.write;
               $scope.out.writeln = $scope.writeln;
               $scope.out.canvas = $scope.canvas;
            }   
            paint(ctx,$scope.out,$scope.userargs,$scope.userinput,cons);
            ctx.restore();
       } catch (exc) {
          var rivi ='';
          var sarake = '';
          if (exc.column) sarake = ' Col '+exc.column.toString()+': ';
          if (exc.line) rivi = 'Row '+exc.line+': ';                  // FF has line
          else if (exc.lineNumber) rivi = 'Row '+exc.lineNumber+': '; // Safari has lineNUmber
          $scope.error = rivi+sarake+exc.toString();
          $scope.runError = $scope.error;
       }
       $scope.safeApply();
    };
    
    $scope.safeApply = function(fn) {
        var phase = this.$root.$$phase;
        if(phase == '$apply' || phase == '$digest') {
        if(fn && (typeof(fn) === 'function')) {
          fn();
        }
        } else {
            this.$apply(fn);
        }
    };

};

     /* Heh, lisätäänpä fillCircle kontekstiin :) */
     Object.getPrototypeOf(document.createElement('canvas').getContext('2d')).fillCircle =
       function (x,y,r) {
         this.beginPath();
         this.arc(x, y, r, 0, Math.PI*2, false);
         this.closePath();
         this.fill();
         this.stroke();
       };

var csConsoleApp = angular.module('csConsoleApp', ['ngSanitize']) as ICSConsoleApp;
// csApp.directive('csRunner', ['$sanitize', function ($sanitize) { csApp.sanitize = $sanitize; return csApp.directiveFunction('console', false); }]);
csConsoleApp.directive('csConsole', ['$sanitize', '$timeout', function ($sanitize, $timeout) { return csConsoleApp.directiveFunction('shell', true); }]);

csConsoleApp.directiveFunction = function (t, isInput) {


// csConsoleApp.directive('csConsole', function ($timeout) {
     return {
         restrict: 'E',
         controller: csConsoleApp.Controller,
         scope: {},
         template: csConsoleApp.directiveTemplateCS(t, isInput),
         // templateUrl: function (elem, attrs) {
         //    return "http://" + elem.parent().attr('data-plugin') + "/" + 'NewConsole/Console.template.html';
         // },
         transclude: true,
         replace: true,
         link: function (scope, element, attrs) {
			csApp.set(scope,attrs,"usercode","");
  			csApp.set(scope,attrs,"type","cs");
  			csApp.set(scope,attrs,"path");
  			csApp.set(scope,attrs,"savestate");
            scope.pwd = ConsolePWD.getPWD(scope);
            scope.oldpwd = scope.pwd;
            scope.isShell = languageTypes.getRunType(scope.type,false) == "shell";
  			if ( scope.usercode === "" && scope.byCode )  scope.usercode = scope.byCode.split("\n")[0];
            scope.currentInput = scope.usercode;
            if ( scope.isShell ) ConsolePWD.register(scope);
         }
     };
};


// controller: function($scope,$http,$transclude,$element, $sce ) {
csConsoleApp.Controller = function ($scope, $http, $transclude, $element, $timeout) {

    $scope.attrs = {} as any;

    $transclude(function(clone, scope) {
        if ( TESTWITHOUTPLUGINS ) return;
        if ( !clone[0] ) return;
        var markJSON = "xxxJSONxxx";
        var markHex = "xxxHEXJSONxxx";
        var s = clone[0].textContent;
        var chex = s.indexOf(markHex) === 0;
        var cjson = s.indexOf(markJSON) === 0;
        if ( !chex && !cjson ) {
            $scope.byCode = s;
            return;
        }
        if ( cjson ) s = s.substring(markJSON.length);
        if ( chex ) s = csApp.Hex2Str(s.substring(markHex.length));
        $scope.attrs = JSON.parse(s);
        $scope.byCode = $scope.attrs.by || $scope.attrs.byCode;
    });
    //controller: function ($scope, $element, $sce, $http) {
    // This block could be re-used
    $scope.taskId = $element.parent().attr("id");
    $scope.plugin = $element.parent().attr("data-plugin");
    var reqPath = $scope.plugin + "/" + $scope.ident + "/";
    // $scope.content = JSON.parse($element.attr("data-content"));
    $scope.content = $scope.attrs;
    // End of generally re-usable TIM stuff

    $scope.examples = [];

    if ( $scope.content.examples) {
        var s = $scope.content.examples.replace(/'/g, '"');
        $scope.examples = JSON.parse(s);
    }

    
    $scope.setPWD = function(pwd) {
        $scope.pwd = pwd;
    }
    
    
    $scope.history = [];

    $scope.loadExample = function (i) {
        $scope.currentInput = $scope.examples[i].expr;
        $scope.focusOnInput();
    };
    $scope.focusOnInput = function () {
        var el = $element[0].querySelector(".console-input");
        el.focus();

    };
    $scope.handler = function () {
        var url = "/cs/answer";
        if ($scope.plugin) {
            // url = "/csPlugin" + /*$scope.plugin + */ "/" + $scope.taskId + "/answer/"; // Häck to get same origin
            url = $scope.plugin;
            var i = url.lastIndexOf("/");
            if (i > 0) url = url.substring(i);
            url += "/" + $scope.taskId + "/answer/";  // Häck piti vähän muuttaa, jotta kone häviää.
        }
        var t = languageTypes.getRunType($scope.content.type, "shell");
        var ucode = $scope.currentInput;
        var isInput = false;
        var uargs = "";
        var uinput = "";

        $http<{web: {pwd?: string, error?: string, console?: string}}>({
                method: 'PUT',
                url: url,
                data: {
                  'input': {
                      'usercode': ucode, 'userinput': uinput, 'isInput': isInput, 'userargs': uargs,
                      // "input": $scope.currentInput,
                      'markup': { 'type': t, 'taskId': $scope.taskId, 'user_id': $scope.content.user_id }
                  }
              }
        })
         .then(function (response) {
             let data = response.data;
             var s = "";
             $scope.oldpwd = $scope.pwd;
             if ( data.web.pwd ) ConsolePWD.setPWD(data.web.pwd,$scope);
             if (data.web.error ) {
                 s = data.web.error;
                 s = "<pre>" + s + "</pre>";
             } else {
                 s = data.web.console
                 if (!$scope.isHtml) s = "<pre>" + s + "</pre>";
             }
             $scope.submit(s);
             // console.log(["data", data.web]);
         }, function (response) {
             console.log(["protocol error", response]);
             $scope.submit("Endless loop?");
         });

    };
    $scope.currentSize = "normal";
    $scope.currentInput = "";
    $scope.cursor = $scope.history.length; // $scope.history.length means new input is last command.

    $scope.toggleSize = function () {
        if ($scope.currentSize === "normal")
        { $scope.currentSize = "enlarged"; }
        else { $scope.currentSize = "normal"; }
    };

    $scope.submit = function (result) {

        $scope.history.push({
            istem: $scope.isShell ? $scope.history.length + " " + $scope.oldpwd + "$": "in_"+ $scope.history.length+": ",
            ostem: $scope.isShell ?  "" : "out_"+ $scope.history.length+": ",
            input: $scope.currentInput,
            response: result
        });
        $scope.currentInput = ""; $scope.cursor = $scope.history.length;
        $timeout(function () {
            var el = $element[0].querySelector(".console-output");
            el.scrollTop = el.scrollHeight;
        });
    };

    $scope.load = function () {
        if ($scope.cursor >= $scope.history.length)
        { $scope.currentInput = ""; $scope.cursor = $scope.history.length; return; }
        var norm = Math.min($scope.history.length - 1, Math.max(0, $scope.cursor));
        $scope.currentInput = $scope.history[norm].input;
        $scope.cursor = norm;
    };


    $scope.up = function() {
        if ( !$scope.cursor ) return;
        $scope.cursor--; $scope.load();
    }
    
    $scope.down = function() {
        $scope.cursor++; $scope.load();
    }
    
    $scope.handleKey = function (ev) {
        if (ev.which === 13) $scope.handler();// submit();
        if (ev.which === 40) { $scope.down(); }
        if (ev.which === 38) { $scope.up(); }
    };
};
 

csConsoleApp.directiveTemplateCS = function (t, isInput) {

    if (TESTWITHOUTPLUGINS) return '';
    return '<div class="web-console no-popup-menu {{currentSize}} "'+
     '    ng-keydown="handleKey($event)" >'+
     ''+
     '<code class="console-output">'+
     ' <div class="console-output-elem" '+
     '    ng-repeat="item in history track by $index">'+
     '<span class="console-oldinput">'+
     '  <span class="console-in">{{item.istem}}</span>'+
     '  <span class="console-userInput">{{item.input}}</span>'+
     ' </span>'+
     ' <span  class="console-oldresponse">'+
     '<span ng_if="!isShell">'+
     '  <br />' +
     '  <span class="console-out">{{item.ostem}}</span>'+
     '</span>'+
     '  <span class="console-response" ng-class="{error:item.error}"><span ng-bind-html="item.response"></span></span> <!-- Double span since ng-bind eats the innermost one --!>'+
     ' </span>'+
     '</div>'+
     '<span class="console-expander-sym"'+
     '    ng-click="toggleSize()"></span>'+
     '</code>'+
     '<div class="console-examples-box">'+
     '    <span class="examples-title"'+
     '    ng-click="examplesVisible=!examplesVisible" >'+
     '    ▼ example expressions ▲</span>' +
     '<div>Click to load:</div>'+
     '<ul >'+
     '    <li ng-repeat="example in examples track by $index">'+
     '    <a ng-click="loadExample($index)" title="{{example.expr}}">{{example.title||example.expr}}</a>' +
     '    </li>'+
     '<ul>'+
     '</div>'+
     ''+
     '<div class="console-curIndex" ng-if="isShell">{{pwd}}</div>'+
     '<span class="console-curIndex">in_{{cursor}}</span>'+
     '<input type="text" '+
     '    placeholder="type expressions here"'+
     '        class="console-input"'+
     '        ng-model="currentInput" />&nbsp;'+
     '<div class="console-buttons">'+
     '<button ng-click="up()">↑</button>&nbsp;' +
     '<button ng-click="down()">↓</button>&nbsp;' +
	 '<button ng-click="handler()">Enter</button>&nbsp;'+
     '</div>'+
     '</div>';
};
 
 
function truthTable(sentence,topbottomLines) {
  
  var result = "";
  try {
      if ( !sentence ) return "";
      if ( !sentence.trim() ) return "";
      var replace = "v ||;^ &&;~ !;∧ &&;∨ ||;∼ !;xor ^;and &&;not !;or ||;ja &&;ei !;tai ||"; 
      var abcde = "abcdefghijklmnopqrstuxy";
      var header = "";
      var vals = '""';
      var count = 0;
      var cnt2 = 1;
      
      var input = sentence.toLowerCase();

      var repls = replace.split(";");
      for (let i of repls) {
          var r = i.split(" ");
          input = input.split(r[0]).join(r[1]);
      }

      for (var i=0; i<abcde.length; i++) {
          if ( input.indexOf(abcde[i]) >= 0 ) {
              header += abcde[i] + " ";
              var zv = "z["+count+"]";
              input = input.split(abcde[i]).join(zv);
              vals += '+' + zv + '+" "';
              count++;
              cnt2 *= 2;
          } 
      }
      
      
      var sents = sentence.split(";");
      var lens = [];
      var fills = [];
      for (i=0; i<sents.length; i++) {
          sents[i] = sents[i].trim();
          lens[i] = sents[i].length;
          fills[i] = "                                                               ".substring(0,lens[i]);
      }
      header += "  " + sents.join("  ");
      var line = "---------------------------------------".substring(0,header.length);
      // result += input + "\n";
      if ( topbottomLines )  result += line + "\n";
      result += header + "\n";
      result += line + "\n";
      for (var n = 0; n < cnt2; n++ ) {
          var z = [];
          for (i=0; i < count; i++)
                z[i] = (n >> (count-1-i)) & 1;
          result += eval(vals) + "= ";  
          var inp = input.split(";");
          for (i=0; i<inp.length; i++) {
            var tulos = " " + (eval(inp[i]) ? 1 : 0) + fills[i];
            result += tulos;
          }  
          result += "\n";
      } 
      if ( topbottomLines )  result += line + "\n";
      return result;
  } catch (err) {
      return result + "\n" + err + "\n";
  }
}
