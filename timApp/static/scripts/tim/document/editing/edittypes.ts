export interface PendingCollection {
    [parId: string]: string;
}

export interface IParResponse {
    texts: string;
    js: string[];
    jsModuleIds: string[];
    css: string[];
    changed_pars: PendingCollection;
    version: [number, number];
    duplicates?: Duplicate[];
    original_par?: {md: string, attrs: any};
    new_par_ids?: string[];
}

export interface IManageResponse {
    duplicates: Duplicate[];
    versions: Array<{}>; // TODO
    fulltext: string;
}

export interface IParInfo {
    "ref-id"?: string;
    "ref-doc-id"?: string;
    "ref-t"?: string;
    "ref-attrs"?: string;
    par: string;
    par_next?: string;
    area_start?: string;
    area_end?: string;
}

export type ITags = {markread: boolean, marktranslated?: boolean};

export interface IExtraData extends IParInfo {
    // attrs: {classes: string[], [i: string]: any};
    docId: number;
    isComment?: boolean;
    id?: string; // note id
    forced_classes?: string[];
    access?: string;
    tags: ITags;
}

export type Duplicate = [string, string] | [string, string, "hasAnswers"];

export interface IChangelogEntry {

}
