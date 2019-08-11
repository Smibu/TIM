import * as t from "io-ts";
import {IError, IJsRunnerMarkup, INumbersObject} from "../public/javascripts/jsrunnertypes";
import {AliasDataT, UserFieldDataT} from "../servertypes";


const TASK_PROG = new RegExp(/([\w.]*)\( *(\d*) *, *(\d*) *\)(.*)/);

/**
 * TODO: Importing this from util.ts breaks jsrunner build? As does exporting from here
 * Return fields widened, so string "d(1,4);dsum" coes out as
 * a list ["d1, "d2", "d3", "dsum"]
 * @param fields string/list to widen
 */
export function widenFields(fields: string | string[]): string[] {
    let fields1: string[] = [];
    if (!(fields instanceof Array)) {
        fields = fields.split(";");
    }
    for (const field of fields) {
        const parts = field.split(";");
        fields1 = fields1.concat(parts);
    }

    const rfields: string[] = [];
    for (const field of fields1) {
        const parts = field.split("=");
        let a = "";
        const tf = parts[0].trim();
        if (parts.length > 1) {
            a = parts[1].trim();
        }
        const m = TASK_PROG.exec(tf);
        if (!m) {
            rfields.push(field);
            continue;
        }

        const tb = m[1];
        const n1 = parseInt(m[2], 10);
        const n2 = parseInt(m[3], 10);
        const te = m[4];

        for (let i = n1; i <= n2; i++) {
            let tn = tb + i + te;
            if (!tb) {
                tn = "";
            }
            if (a) {
                tn += "=" + a + i;
            }
            rfields.push(tn);
        }
    }
    return rfields;
}


/**
 * From name=alias list returns two lists
 * @param fields list of name=alias pairs
 */
function separateNamesAndAliases(fields: string[]): {names: string[], aliases: string[] } {
    const raliases: string[] = [];
    const rnames: string[] = [];
    for (const f of fields) {
        const parts = f.split("=");
        const fn = parts[0].trim();
        if ( !fn ) { continue; }
        if ( rnames.indexOf(fn) >= 0) { continue; }
        rnames.push(fn);
        if ( parts.length < 2) {
            raliases.push(fn);
        } else {
            raliases.push(parts[1].trim());
        }
    }
    return { names: rnames, aliases: raliases};
}

function genericTypeError(parameterDescription: string, v: unknown) {
    return new Error(`${parameterDescription} has unexpected type: ${typeof v}`);
}

function fieldNameTypeError(v: unknown) {
    return genericTypeError("fieldName", v);
}

function defaultValueTypeError(v: unknown) {
    return genericTypeError("default value", v);
}

function valueTypeError(v: unknown) {
    return genericTypeError("value", v);
}

const checkString = t.string.is;
const checkNumber = t.number.is;
const checkInt = t.Int.is;

const StringOrNumber = t.union([t.string, t.number]);

function ensureStringFieldName(s: unknown): string {
    if (!checkString(s)) {
        throw fieldNameTypeError(s);
    }
    return s;
}

function ensureNumberDefault(s: unknown): number {
    if (!checkNumber(s)) {
        throw defaultValueTypeError(s);
    }
    return s;
}

function ensureIntDefault(s: unknown): number {
    if (!checkInt(s)) {
        throw defaultValueTypeError(s);
    }
    return s;
}

function ensureStringDefault(s: unknown): string {
    if (!checkString(s)) {
        throw defaultValueTypeError(s);
    }
    return s;
}

function ensureNumberLikeValue(s: unknown): number {
    if (!StringOrNumber.is(s)) {
        throw valueTypeError(s);
    }
    if (typeof s === "string") {
        const v = parseFloat(s.replace(",", "."));
        if (isNaN(v)) {
            throw valueTypeError(s);
        }
        return v;
    }
    return s;
}

function ensureStringLikeValue(s: unknown): string {
    if (!StringOrNumber.is(s)) {
        throw valueTypeError(s);
    }
    if (typeof s === "number") {
        return s.toString();
    }
    return s;
}

function round(c: number, decim: number): number {
    if ( decim == null || isNaN(decim) ) { return c; }
    const mul = Math.pow(10, decim);
    return Math.round(c * mul) / mul;
}

const ABSOLUTE_FIELD_REGEX = /^[0-9]+\./;

interface Point {
    x: number;
    y: number;
}

interface Linear { // y = a + bb
    a: number;
    b: number;
}

// const dummyGTools: GTools = new GTools(

class WithGtools {
    private gt?: GTools;

    constructor(gtools: GTools) {
        this.gt = gtools;
    }

    public clearGtools() {
        this.gt = undefined;
    }

    get gtools(): GTools {
        if ( !this.gt ) {
            throw new Error("Can not use tools anymore");
        }
        return this.gt;
    }

}

class LineFitter extends WithGtools {
    // see: http://mathworld.wolfram.com/LeastSquaresFitting.html
    private n = 0;
    private sumX  = 0;
    private sumX2 = 0;
    private sumXY = 0;
    private sumY  = 0;
    private sumY2 = 0;
    private minX = 1e100;
    private maxX = -1e100;
    private minY = 1e100;
    private maxY = -1e100;
    readonly xname: string;
    readonly yname: string;
    private cab: Linear | null = null;
    public readonly autoadd: boolean;

    constructor(gtools: GTools, xname: string, yname: string, autoadd: boolean = true) {
        super(gtools);
        this.autoadd = autoadd;
        this.xname = xname;
        this.yname = yname;
    }

    add(x: number, y: number): Point {
        if ( !isNaN(x) &&  !isNaN(y) ) {
            this.n++;
            this.sumX += x;
            this.sumX2 += x * x;
            this.sumXY += x * y;
            this.sumY += y;
            this.sumY2 += y * y;
            if (x < this.minX) { this.minX = x; }
            if (x > this.maxX) { this.maxX = x; }
            if (y < this.minY) { this.minY = y; }
            if (y > this.maxY) { this.maxY = y; }
            this.cab = null;
        }
        return {x: x, y: y};
    }

    addxy(xy: any): Point {
        this.add(xy.x, xy.y);
        return xy;
    }

    addField(): Point {
        return this.add(this.gtools.tools.getDouble(this.xname, NaN), this.gtools.tools.getDouble(this.yname, NaN));
    }

    ab(adecim: number = NaN, bdecim: number = NaN): Linear {
        if ( this.cab ) { return this.cab; }
        const div = this.n * this.sumX2 - this.sumX * this.sumX;
        let a = (this.sumY * this.sumX2  - this.sumX * this.sumXY) / div;
        let b = (this.n * this.sumXY - this.sumX * this.sumY) / div;
        if ( !isNaN(adecim) ) { a = round(a, adecim); if ( isNaN(bdecim) ) { bdecim = adecim; }}
        if ( !isNaN(bdecim) ) { b = round(b, bdecim); }
        this.cab = {a: a, b: b};
        return this.cab;
    }

    f(x: number): number {
        const ab = this.ab();
        return ab.a + ab.b * x;
    }

    limits() {
        return {minX: this.minX, maxX: this.maxX, minY: this.minY, maxY: this.maxY, n: this.n};
    }

    r2() {
        const ssxx = this.sumX2 - this.sumX * this.sumX / this.n;
        const ssyy = this.sumY2 - this.sumY * this.sumY / this.n;
        const ssxy = this.sumXY - this.sumX * this.sumY / this.n;
        return (ssxy * ssxy) / (ssxx * ssyy);
    }

    r() {
        return Math.sqrt(this.r2());
    }

    r2string(decim: number) {
        return "r² = " + round(this.r2(), decim);
    }

    rstring(decim: number) {
        return "r = " + round(this.r(), decim);
    }

    line(xdecim: number = NaN, ydecim: number = NaN): Point[] {
        if ( !isNaN(xdecim) && isNaN(ydecim)) { ydecim = xdecim; }
        const x1 = round(this.minX, xdecim);
        const x2 = round(this.maxX, xdecim);
        const y1 = round(this.f(x1), ydecim);
        const y2 = round(this.f(x2), ydecim);
        return [{x: x1, y: y1}, {x: x2, y: y2}];
    }
}

class Distribution extends WithGtools {
    public labels: number[] = [];
    public data: number[]   = [];
    private n = 0;
    private readonly fieldName: string;
    public readonly autoadd: boolean = true;

    constructor(gtools: GTools, fieldName: string, n1: number, n2: number, mul: number = 1, autoadd: boolean) {
        super(gtools);
        this.autoadd = autoadd;
        if ( mul == 0 ) { mul = 1; }
        for (let i = n1; i * mul <= n2 + 0.000001; i++) {
            this.labels[i] = i * mul;
            this.data[i] = 0;
        }
        this.fieldName = fieldName;
    }

    // Add to closest category
    add(x: number): number {
         if ( isNaN(x) ) { return x; }
         let mini = 0;
         let mind = 1e100;
         for (let i = 0; i < this.labels.length; i++) {
             const d = Math.abs(this.labels[i] - x);
             if ( d <= mind ) { mind = d; mini = i; }
         }
         this.data[mini]++;
         this.n++;
         return x;
    }

    addField(): number {
         const x = this.gtools.tools.getDouble(this.fieldName, NaN);
         return this.add(x);
    }

    get() {
        return { labels: this.labels, data: this.data, n: this.n };
    }
}

class XY extends WithGtools {
    public data: object[] = [];
    private readonly xname: string;
    private readonly yname: string;
    public readonly fitter: LineFitter;
    public readonly autoadd: boolean;

    constructor(gtools: GTools, xname: string, yname: string, autoadd: boolean = true) {
        super(gtools);
        this.autoadd = autoadd;
        this.xname = xname;
        this.yname = yname;
        this.fitter = new LineFitter(gtools, xname, yname);
    }

    add(x: number, y: number) {
        const pt = {x: x, y: y};
        if ( !isNaN(x) && !isNaN(y) ) {
            this.data.push(pt);
            this.fitter.add(x, y);
        }
        return pt;
    }

    addField(): object {
        return this.add(this.gtools.tools.getDouble(this.xname, NaN), this.gtools.tools.getDouble(this.yname, NaN));
    }

    clearGtools() {
        super.clearGtools();
        this.fitter.clearGtools();
    }
}

const defaultStatHeaders = ["n", "sum", "avg", "min", "max", "sd"];

class StatCounter {
    private n = 0;
    private sum = 0;
    private min = 1e100;
    private max = -1e100;
    private k = 0;
    private ex = 0;
    private ex2 = 0;

    constructor() {
    }

    addValue(v: number) {
        if (v === undefined) {
            return;
        }
        // See: https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance
        if ( this.n == 0 ) { this.k = v; }
        this.n++;
        this.sum += v;
        const d = v - this.k;
        this.ex += d;
        this.ex2 += d * d;
        if (v < this.min) {
            this.min = v;
        }
        if (v > this.max) {
            this.max = v;
        }
    }

    getStat(): { [hname: string]: number }  {
        let sd = 0;
        const dd = (this.ex2 -  (this.ex * this.ex) / this.n);
        if ( this.n > 1) { sd =  Math.sqrt(dd / (this.n - 1)); }
        return {
            n: this.n,
            sum: this.sum,
            avg: this.sum / this.n,
            min: this.min,
            max: this.max,
            sd: sd,
        };
    }
}

class Stats extends WithGtools {
    private counters: { [fieldname: string]: StatCounter } = {};
    readonly fields: string [] = [];
    readonly aliases: string [] = [];
    readonly autoadd: boolean;

    constructor(gtools: GTools, fields: string | string[], autoadd: boolean = true) {
        super(gtools);
        this.autoadd = autoadd;
        const fa = separateNamesAndAliases(widenFields(fields));
        const flds = fa.names;
        this.aliases = fa.aliases;
        for (const f of flds) {
            this.fields.push(f.trim());
            this.counters[f] = new StatCounter();
        }
    }

    addField() {
        const maxv = 1e100;
        for (const name of this.fields) {
            let v = this.gtools.tools.getDouble(name, NaN);
            if ( isNaN(v) ) { continue; }
            v = Math.min(v, maxv);
            this.addValue(name, v);
        }
    }

    addValue(fieldName: string, value: number, max: number = 1e100) {
        let sc: StatCounter = this.counters[fieldName];
        if ( sc === undefined ) { sc = new StatCounter(); this.counters[fieldName] = sc; }
        if ( isNaN(value) ) { return; }
        const v = Math.min(value, max);
        sc.addValue(v);
    }

    addData(fieldName: string, start: number, end: number, max: unknown = 1e100) {
        const maxv = ensureNumberDefault(max);
        if (!(checkInt(start) && checkInt(end))) {
            throw new Error("Parameters 'start' and 'end' must be integers.");
        }
        for (let i = start; i <= end; i++) {
            const name = fieldName + i.toString();
            let v = this.gtools.tools.getDouble(name, NaN);
            if ( isNaN(v) ) { continue; }
            v = Math.min(v, maxv);
            this.addValue(name, v);
        }
    }

    addOf(...fieldNames: string[]) {
        const maxv = 1e100;
        const fields = widenFields([...fieldNames]);
        for (const name of fields) {
            let v = this.gtools.tools.getDouble(name, NaN);
            if ( isNaN(v) ) { continue; }
            v = Math.min(v, maxv);
            // this.print(name + ": " + v);
            this.addValue(name, v);
        }
    }

    getData(): {[name: string]: INumbersObject} {
        const result: {[name: string]: INumbersObject} = {};
        for (const [name, sc] of Object.entries(this.counters)) {
            result[name] = sc.getStat();
        }
        return result;
    }

    // noinspection JSUnusedGlobalSymbols
    getForTable(headers: string[] | string = "", decim: number = 2): any {
        if ( !headers ) { headers = defaultStatHeaders; }
        if ( !(headers instanceof Array) ) {
            headers = headers.split(";");
        }
        const matrix: any[] = [];
        const result = { headers: [""], matrix: matrix };
        for (const hs of headers) {
            if ( hs ) {
                result.headers.push(hs);
            }
        }
        const statData = this.getData();
        let keys = this.fields;
        let alis = this.aliases;
        if (keys.length == 0) { keys = Object.keys(statData); alis = keys; }
        for (let i = 0; i < keys.length; i++ ) {
            const f = keys[i];
            const a = alis[i];
            const stat = statData[f];
            if ( !stat ) { continue; }
            const row: any[] = [a];
            for (const hs of headers) {
                if ( !hs ) { continue; }
                const val: number = stat[hs];
                row.push((round(val, decim)));
            }
          matrix.push(row);
        }
        return result;
    }

    // noinspection JSUnusedGlobalSymbols
    getForGraph(fields: string | string[], item: string = "avg", decim: number = 2): any {
        const labels: string[] = [];
        const data: number[] = [];
        const result = { labels: labels, data: data };
        let flds = this.fields;
        let alis = this.aliases;
        const statData = this.getData();
        if ( fields ) {
            const fa = separateNamesAndAliases(widenFields(fields));
            flds = fa.names;
            alis = fa.aliases;
        }
        if (flds.length == 0 ) {
            flds = Object.keys(statData);
            alis = flds;
        }
        for (let i = 0; i < flds.length; i++ ) {
            const name = flds[i];
            const a = alis[i];
            const stat = statData[name];
            labels.push(a);
            if ( !stat ) {
                data.push(0);
            } else {
                data.push(round(stat[item], decim));
            }
        }
        return result;
    }
}

export class ToolsBase {
    protected output = "";
    protected errors: IError[] = [];
    public usePrintLine: boolean = false; // if used println at least one time then print does not do nl
    constructor(
        protected currDoc: string,
        protected markup: IJsRunnerMarkup,
        protected aliases: AliasDataT,
    ) {
    }

    getNumber(s: string) {
        const r = parseFloat(s);
        return this.handlePossibleNaN(r, s, 0);
    }

    protected handlePossibleNaN<T>(r: number, s: unknown, def: T) {
        if (isNaN(r)) {
            return this.reportInputTypeErrorAndReturnDef(s, def);
        }
        return r;
    }

    protected reportInputTypeErrorAndReturnDef<T>(s: unknown, def: T) {
        this.reportError(`Found value '${s}' of type ${typeof s}, using default value ${def}`);
        return def;
    }

    public createLimitArray(table: string | string[]): number[][] {
        const res: number[][] = [];
        if ( !(table instanceof Array) ) { table = table.split("\n"); }
        for (const s of table) {
            const parts = s.split(",");
            if ( parts.length < 2 ) { return this.reportInputTypeErrorAndReturnDef(table, []); }
            const limit = this.getNumber(parts[0]);
            const value = this.getNumber(parts[1]);
            res.push([limit, value]);
        }
        return res;
    }

    // noinspection JSMethodCanBeStatic
    public findLastOf(limits: number[][], c: number, def: number = 0) {
        let res = def;
        for (const r of limits) {
            const limit: number = r[0];
            const value: number = r[1];
            if ( c >= limit ) { res = value; }
        }
        return res;
    }

    public findLast(table: string | string[], c: number, def: number = 0) {
        return this.findLastOf(this.createLimitArray(table), c, def);
    }

    // noinspection JSMethodCanBeStatic
    public r(value: number, decim: number): number {
        if ( !checkInt(decim) ) {
            throw new Error("Parameter 'decim' must be integer.");
        }
        const c = ensureNumberDefault(value);
        const mul = Math.pow(10, decim);
        return Math.round(c * mul) / mul;
    }

    public round(value: number, decim: number): number {
        return this.r(value, decim);
    }

    // noinspection JSMethodCanBeStatic
    public wf(fields: string | string[]): string[]  {
        return widenFields(fields);
    }

    public print(...args: unknown[]) {
        let sep = "";
        for (const a of args) {
            let as = a;
            if (typeof a !== "string" && !(a instanceof String)) {
                as = JSON.stringify(a);
            }
            this.output += sep + as;
            sep = " ";
        }
        if ( !this.usePrintLine ) { this.output += "\n"; }
    }

    public println(...args: unknown[]) {
        // For be combatible with Korppi, if only print is used, it prints nl.
        // But if println is used at least one time before print, then print is
        // not printing nl.
        this.usePrintLine = true;
        this.print(...args);
        this.output += "\n";
    }

    public getOutput() {
        return this.output;
    }

    public clearOutput() {
        this.output = "";
    }

    public getErrors() {
        return this.errors;
    }

    public  reportError(msg: string) {
        this.errors.push({msg, stackTrace: new Error().stack});
    }
}

export class GTools extends ToolsBase {
    public outdata: object = {};
    public fitters: { [fieldname: string]: LineFitter } = {};
    public dists: { [fieldname: string]: Distribution } = {};
    public xys: { [fieldname: string]: XY } = {};
    public stats: { [name: string]: Stats } = {};

    public tools: Tools;

    constructor(
        currDoc: string,
        markup: IJsRunnerMarkup,
        aliases: AliasDataT,
        tools: Tools,
    ) {
        super(currDoc, markup, aliases);
        this.tools = tools;
        this.createStatCounter("GLOBAL", "", false);
    }

    createFitter(xname: string, yname: string, autoadd: boolean = true) {
        const fitter = new LineFitter(this, xname, yname, autoadd);
        this.fitters[xname + "_" + yname] = fitter;
        return fitter;
    }

    createDistribution(fieldName: string, n1: number, n2: number, mul: number = 1, autoadd = true) {
        const dist = new Distribution(this, fieldName, n1, n2, mul, autoadd);
        if ( fieldName ) { this.dists[fieldName] = dist; }
        return dist;
    }

    addToDatas() {
        for (const datas of [this.dists, this.xys, this.fitters, this.stats]) {
            // noinspection JSUnusedLocalSymbols
            Object.entries(datas).forEach(
                ([key, d]) => { if ( d.autoadd ) {
                    d.addField();
                 }});
        }
    }

    clearGtools() {
        for (const datas of [this.dists, this.xys, this.fitters, this.stats]) {
            // noinspection JSUnusedLocalSymbols
            Object.entries(datas).forEach(
                ([key, d]) => {
                    d.clearGtools();
                 });
        }
    }

    createXY(xname: string, yname: string, autoadd: boolean = true) {
        const xy = new XY(this, xname, yname, autoadd);
        this.xys[xname + "_" + yname] = xy;
        return xy;
    }

    createStatCounter(name: string, fields: string | string[], autoadd: boolean = true) {
        const stats = new Stats(this, fields, autoadd);
        this.stats[name] = stats;
        return stats;
    }

    addStatDataValue(fieldName: string, value: number) {
        this.stats.GLOBAL.addValue(fieldName, value);
    }

    addStatData(fieldName: string, start: number, end: number, max: number = 1e100) {
        this.stats.GLOBAL.addData(fieldName, start, end, max);
    }

    addStatDataOf(...fieldNames: string[]) {
        this.stats.GLOBAL.addOf(...fieldNames);
    }

    getStatData(): {[name: string]: INumbersObject} {
        return this.stats.GLOBAL.getData();
    }

    // noinspection JSMethodCanBeStatic
    r(value: number, decim: number): number {
        if ( !checkInt(decim) ) {
            throw new Error("Parameter 'decim' must be integer.");
        }
        const c = ensureNumberDefault(value);
        const mul = Math.pow(10, decim);
        return Math.round(c * mul) / mul;
    }

    round(value: number, decim: number): number {
        return this.r(value, decim);
    }

    setTools(tools: Tools) {
        this.tools = tools;
    }
}

export class Tools extends ToolsBase {
    private result: {[index: string]: unknown} = {};
    constructor(
        protected data: UserFieldDataT,
        currDoc: string,
        markup: IJsRunnerMarkup,
        aliases: AliasDataT,
    ) {
        super(currDoc, markup, aliases);
    }

    private normalizeField(fieldName: string) {
        if (ABSOLUTE_FIELD_REGEX.test(fieldName)) {
            return fieldName;
        } else {
            return this.currDoc + fieldName;
        }
    }

    private normalizeAndGet(fieldName: string) {
        if (fieldName in this.aliases) {
            return this.data.fields[fieldName];
        }
        const fn = this.normalizeField(fieldName);
        return this.data.fields[fn];
    }

    private checkAliasAndNormalize(fieldName: string) {
        if (fieldName in this.aliases) {
            return this.normalizeField(this.aliases[fieldName]);
        }
        return this.normalizeField(fieldName);
    }

    getRealName(): string {
        return this.data.user.real_name;
    }

    getUserName(): string {
        return this.data.user.name;
    }

    getDouble(fieldName: unknown, defa: unknown = 0): number {
        const f = ensureStringFieldName(fieldName);
        const def = ensureNumberDefault(defa);
        const s = this.normalizeAndGet(f);
        if (checkNumber(s)) {
            return this.handlePossibleNaN(s, s, def);
        }
        if (s === null || s === undefined  ) {
            return def;
        }
        if (typeof s !== "string") {
            return this.reportInputTypeErrorAndReturnDef(s, def);
        }
        const st = s.trim();
        if ( st == "" ) { return def;  }
        const sp = st.replace(",", ".");
        const r = parseFloat(sp);
        return this.handlePossibleNaN(r, s, def);
    }

    getInt(fieldName: unknown, defa: unknown = 0): number {
        const f = ensureStringFieldName(fieldName);
        const def = ensureIntDefault(defa);
        const s = this.normalizeAndGet(f);
        if (checkInt(s)) {
            return this.handlePossibleNaN(s, s, def);
        }
        if (s === null || s === undefined) {
            return def;
        }
        if (typeof s !== "string") {
            return this.reportInputTypeErrorAndReturnDef(s, def);
        }
        const r = parseInt(s, 10);
        return this.handlePossibleNaN(r, s, def);
    }

    getString(fieldName: unknown, defa: unknown = ""): string {
        const f = ensureStringFieldName(fieldName);
        const def = ensureStringDefault(defa);
        let s = this.normalizeAndGet(f);
        if (s === null || s === undefined) {
            s = def;
        }
        // if (!checkString(s)) {  // if number this returns error :-(
        //     return this.reportInputTypeErrorAndReturnDef(s, def);
        // }
        // @ts-ignore
        const st: string = s;
        return st.toString();
    }

    getValue(fieldName: unknown, def: unknown = "") {
        const f = ensureStringFieldName(fieldName);
        let s = this.normalizeAndGet(f);
        if (s === null || s === undefined) {
            s = def;
        }
        return s;
    }

    createLimitArray(table: string | string[]): number[][] {
        const res: number[][] = [];
        if ( !(table instanceof Array) ) { table = table.split("\n"); }
        for (const s of table) {
            const parts = s.split(",");
            if ( parts.length < 2 ) { return this.reportInputTypeErrorAndReturnDef(table, []); }
            const limit = this.getNumber(parts[0]);
            const value = this.getNumber(parts[1]);
            res.push([limit, value]);
        }
        return res;
    }

    // noinspection JSMethodCanBeStatic
    findLastOf(limits: number[][], c: number, def: number = 0) {
        let res = def;
        for (const r of limits) {
            const limit: number = r[0];
            const value: number = r[1];
            if ( c >= limit ) { res = value; }
        }
        return res;
    }

    findLast(table: string | string[], c: number, def: number = 0) {
        return this.findLastOf(this.createLimitArray(table), c, def);
    }

    // noinspection JSMethodCanBeStatic
    r(value: number, decim: number): number {
        if ( !checkInt(decim) ) {
            throw new Error("Parameter 'decim' must be integer.");
        }
        const c = ensureNumberDefault(value);
        const mul = Math.pow(10, decim);
        return Math.round(c * mul) / mul;
    }

    round(value: number, decim: number): number {
        return this.r(value, decim);
    }

    // noinspection JSMethodCanBeStatic
    wf(fields: string | string[]): string[]  {
        return widenFields(fields);
    }

    getSum(fieldName: unknown, start: number, end: number, defa: unknown = 0, max: unknown = 1e100): number {
        const f = ensureStringFieldName(fieldName);
        const def = ensureNumberDefault(defa);
        const maxv = ensureNumberDefault(max);
        if (!(checkInt(start) && checkInt(end))) {
            throw new Error("Parameters 'start' and 'end' must be integers.");
        }
        let sum = 0;
        for (let i = start; i <= end; i++) {
            sum += Math.min(this.getDouble(f + i.toString(), def), maxv);
        }
        return sum;
    }

    getSumOf(...fieldNames: string[]): number {
        const def = 0;
        const maxv = 1e100;
        let sum = 0;
        const fields = widenFields([...fieldNames]);
        for (const fn of fields) {
            sum += Math.min(this.getDouble(fn, def), maxv);
        }
        return sum;
    }

    setString(fieldName: unknown, content: unknown): void {
        const f = ensureStringFieldName(fieldName);
        const c = ensureStringLikeValue(content);
        const fn = this.checkAliasAndNormalize(f);
        this.result[fn] = c;
        this.data.fields[fn] = c;
    }

    setInt(fieldName: unknown, content: unknown, maxNotToSave: number = -1000000000): void {
        const f = ensureStringFieldName(fieldName);
        const c = ensureNumberLikeValue(content);
        const fn = this.checkAliasAndNormalize(f);
        if (!checkInt(c)) {
            throw valueTypeError(content);
        }
        if ( c <= maxNotToSave ) {
            if ( this.getValue(fieldName, "") !== "") { this.setString(fieldName, ""); }
            this.data.fields[fn] = "";
            return;
        }
        this.result[fn] = c;
        this.data.fields[fn] = c;
    }

    setDouble(fieldName: unknown, content: unknown, maxNotToSave: number = -1e100): void {
        const f = ensureStringFieldName(fieldName);
        const c = ensureNumberLikeValue(content);
        const fn = this.checkAliasAndNormalize(f);
        if ( c <= maxNotToSave ) {
            if ( this.getValue(fieldName, "") !== "") { this.setString(fieldName, ""); }
            this.data.fields[fn] = "";
            return;
        }
        this.result[fn] = c;
        this.data.fields[fn] = c;
    }

    getDefaultPoints(): number {
        if (!this.markup.defaultPoints) {
            throw new Error("defaultPoints have not been set.");
        }
        return this.markup.defaultPoints;
    }

    getGrade(points: unknown): string | number {
        if (!checkNumber(points)) {
            throw new Error("points must be number.");
        }
        if (!this.markup.gradingScale) {
            throw new Error("gradingScale has not been set.");
        }
        const scale = this.markup.gradingScale;
        const values = Object.entries(scale);
        values.sort((a, b) => b[1] - a[1]);
        let grade = this.markup.failGrade || "";
        for (const [currGrade, requiredPoints] of values) {
            if (points >= requiredPoints) {
                grade = currGrade;
                break;
            }
        }
        return grade;
    }

    saveGrade(gradeVal: unknown, points: unknown = this.markup.defaultPoints) {
        const d = this.markup.gradeField || "grade";
        const fn = this.checkAliasAndNormalize(d);
        this.result[fn] = gradeVal;
        const c = this.markup.creditField || "credit";
        const fnc = this.checkAliasAndNormalize(c);
        let p;
        if (points !== undefined) {
            p = ensureNumberLikeValue(points);
            if (!checkInt(p)) {
                throw new Error("points is not integer.");
            }
        } else {
            p = 0;
        }
        this.result[fnc] = p;
    }

    static defineTime(s: unknown): number {
        if (!checkString(s)) {
            throw valueTypeError(s);
        }
        // TODO: fix timezone to work locally
        const localDateTime = new Date(s);
        const offset = localDateTime.getTimezoneOffset() * 60;
        return (localDateTime.getTime() / 1000) + offset;
    }

    getDateTime(fieldName: unknown, defa: unknown = NaN): number {
        const f = ensureStringFieldName(fieldName);
        const def = ensureNumberDefault(defa);
        return this.getDouble(f, def);
    }

    getResult() {
        return {user: this.data.user.id, fields: this.result};
    }
}

