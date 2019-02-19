import {IScope} from "angular";
import {$compile, $injector, $log, $timeout} from "tim/util/ngimport";
import {timLogTime} from "tim/util/timTiming";
import {ViewCtrl} from "../document/viewctrl";
import {fixDefExport, injectStyle, ModuleArray} from "../util/utils";

export interface IPluginInfoResponse {
    js: string[];
    texts: string;
    css: string[];
    trdiff?: {old: string, new: string};
}

export function compileWithViewctrl(html: string | Element,
                                    scope: IScope,
                                    view: ViewCtrl | undefined,
                                    extraCtrls: {[name: string]: {instance: unknown}} = {}) {
    return $compile(html)(scope,
        undefined,
        view ? {
            transcludeControllers: {
                timView: {instance: view},
                timReview: {instance: view.reviewCtrlScope!.$ctrl},
                ...extraCtrls,
            },
        } : {});
}

export class ParagraphCompiler {
    public async compile(data: IPluginInfoResponse, scope: IScope, view?: ViewCtrl) {
        for (const m of data.js) {
            const mod = await import(m);
            const defs = mod.moduleDefs;
            if (ModuleArray.is(defs)) {
                $injector.loadNewModules(defs.map((d) => d.name));
            }
        }
        data.css.forEach((s) => injectStyle(s));
        const compiled = compileWithViewctrl(data.texts, scope, view);
        await this.processAllMathDelayed(compiled);
        return compiled;
    }

    public async processAllMathDelayed($elem: JQuery, delay?: number) {
        await $timeout(() => {
            this.processAllMath($elem);
        }, delay || 300);
    }

    public async processAllMath($elem: JQuery) {
        const katexFailures: Element[] = [];
        const mathelems = $elem.find(".math");
        if (mathelems.length === 0) {
            return;
        }
        timLogTime("processAllMath start", "view");
        const renderMathInElement = fixDefExport(await import("katex-auto-render"));
        mathelems.each((index, elem) => {
            const result = this.processMath(renderMathInElement, elem, false);
            if (result != null) {
                katexFailures.push(result);
            }
        });
        if (katexFailures.length > 0) {
            this.processMathJax(katexFailures);
        }
        timLogTime("processAllMath end", "view");
    }

    public async processMathJax(elements: Element[] | Element) {
        const MathJax = await import("mathjax");
        MathJax.Hub!.Queue(["Typeset", MathJax.Hub, elements]);
    }

    /**
     * Processes the math for a single element.
     *
     * @param katexFunction The KaTeX function that processes the elements.
     * @param elem The HTML element to process.
     * @param tryMathJax true to attempt to process using MathJax if KaTeX fails.
     * @returns null if KaTeX processed the element successfully. Otherwise, the failed element.
     */
    public processMath(katexFunction: (e: Element) => void,
                       elem: Element,
                       tryMathJax: boolean): Element | null {
        try {
            katexFunction(elem);
            return null;
        } catch (e) {
            $log.warn(e.message);
            if (tryMathJax) {
                this.processMathJax(elem);
            }
            return elem;
        }
    }
}

export const ParCompiler = new ParagraphCompiler();
