import moment, {Moment} from "moment";
import {IRights} from "../user/IRights";
import {IGroup} from "../user/IUser";
import {$http} from "../util/ngimport";

export interface IDocument extends IItem {
    isFolder: false;
    src_docid?: number;
}

export interface IFullDocument extends IDocument {
    fulltext: string;
    versions: Array<{}>; // TODO proper element type
}

export type DocumentOrFolder = IDocument | IFolder;

export interface IItem {
    id: number;
    location: string;
    modified: string; // TODO change type to Moment
    name: string;
    owner: IGroup;
    path: string;
    public: boolean;
    relevance?: IRelevance;
    rights: IRights;
    title: string;
    unpublished: boolean;
}

export interface IRelevance {
    block_id: number;
    relevance: number;
}

export interface ITag {
    block_id: number;
    expires?: Moment;
    type: TagType;
    name: string;
}

export interface IFolder extends IItem {
    isFolder: true;
}

export enum TagType {
    Regular = 1,
    CourseCode = 2,
    Subject = 3,
}

export interface ICourseSettings {
    course_subjects: ISubjectList;
}

// A list of course subjects. May contain lists within lists.
export type ISubjectList = string | {[subject: string]: ISubjectList[]};

export interface ITaggedItem extends IItem {
    tags: ITag[];
}

export async function getItem(itemId: number) {
    return (await $http.get<IItem>(`/items/${itemId}`)).data;
}

/**
 * Check if item is root folder.
 * @param item Item to check.
 * @returns {boolean} True if root folder.
 */
export function isRootFolder(item: IItem) {
    return item.id === -1;
}

/**
 * Returns course code if it exists for the item.
 * @param {ITag[]} tags A list of tags.
 * @param {boolean} checkExpiration If true, expired courses will be return as undefined.
 * @returns {string} The course code as a string or undefined if none was found.
 */
export function getCourseCode(tags: ITag[], checkExpiration: boolean = false) {
    for (const tag of tags) {
        if (tag.type === TagType.CourseCode) {
            if (checkExpiration && tagIsExpired(tag)) {
                return undefined;
            }
            return tag.name;
        }
    }
    return undefined;
}

/**
 * Checks if the tag has expired.
 * @param {ITag} tag
 * @returns {boolean} False if the tag has no expiration or hasn't yet expired.
 */
export function tagIsExpired(tag: ITag) {
    if (tag.expires) {
        if (tag.expires.diff(moment.now()) < 0) {
            return true;
        }
    } else {
        return false;
    }
}

/**
 * Set tag css style classes depending on the tag type. Currently normal tags are light blue-green
 * special tags green, selected tag red with borders and expired tags fainter colored..
 * @param {ITag} tag The tag.
 * @param {boolean} selected Whether the tag is selected tag.
 * @returns {string} String containing style classes.
 */
export function tagStyleClass(tag: ITag, selected: boolean) {
    let opacity = "";
    let highlight = "";
    let color = "btn-success";
    if (tagIsExpired(tag)) {
        opacity = "less-opacity";
    }
    if (tag.type === TagType.Regular) {
        color = "btn-primary";
    }
    if (selected) {
        color = "btn-danger";
        highlight = "selected-tag";
    }
    return color + " " + opacity + " " + highlight;
}
