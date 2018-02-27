import moment, {Moment} from "moment";
import {IUser} from "./IUser";

export interface IExplCollection {
    [idString: string]: string;
}

export interface IQuestionMarkup extends IAskedJsonJson {
    button?: string;
    buttonText?: string;
    lazy?: boolean;
    isTask: boolean; // if false, it is a lecture question
    header?: string;
    footer?: string;
    resetText?: string;
    stem?: string;
}

export interface IQuestionParagraph extends IUniqueParId {
    markup: IQuestionMarkup;
    qst: boolean;
    taskId?: string;
    // TODO: include also other attributes
}

export interface IAskedJsonBase {
    answerFieldType: AnswerFieldType;
    expl?: IExplCollection;
    matrixType: MatrixType; // is useless
    points?: string;
    questionText: string;
    questionTitle: string;
    questionType: QuestionType;
    timeLimit?: number;
}

export interface IAskedJsonJson extends IUnprocessedHeaders, IAskedJsonBase {

}

export type QuestionType =
    "checkbox-vertical"
    | "matrix"
    | "radio-vertical"
    | "true-false"
    | "textarea"
    | "likert"
    | "";

export type MatrixType = "textArea" | "" | "radiobutton-horizontal" | "radiobutton-vertical" | "checkbox";

export type AnswerFieldType = "radio" | "checkbox" | "matrix" | "text"; // TODO matrix seems wrong

export interface IHeader {
    text: string;
    type: string;
    id: number;
}

export interface IColumn {
    id: number;
    rowId: number;
    text: string;
    type: string;
    answerFieldType: AnswerFieldType; // TODO useless field?
}

export interface IRow extends IHeader {
    columns: IColumn[];
}

export interface IUnprocessedHeaders {
    headers: (IHeader | string)[];
    rows: (IRow | string)[];
}

export interface IProcessedHeaders {
    headers: IHeader[];
    rows: IRow[];
}

export interface IQuestionUI {
    endTimeSelected: boolean;
    timeLimitFields: {hours: number, minutes: number, seconds: number};
}

export interface IAskedJson {
    hash: string;
    json: IAskedJsonJson;
}

export interface IAskedQuestion {
    asked_id: number;
    lecture_id: number;
    doc_id: number;
    par_id: string;
    asked_time: Moment;
    json: IAskedJson;
}

export interface ILectureMessage {
    msg_id: number;
    user: IUser;
    timestamp: Moment;
    message: string;
}

export interface ILectureFormParams extends ILecture {
}

export interface ILectureOptions {
    max_students: number;
    poll_interval: number;
    poll_interval_t: number;
    long_poll: boolean;
    long_poll_t: boolean;
}

export interface ILecture {
    doc_id: number;
    lecture_id: number;
    lecture_code: string;
    start_time: Moment;
    end_time: Moment;
    password: string;
    options: ILectureOptions;
    is_full: boolean;
    is_access_code: boolean;
}

export interface IQuestionAnswer {
    answer_id: number;
    user: IUser;
    points: number;
    answer: AnswerTable;
    asked_question: IAskedQuestion;
}

export interface ILecturePerson {
    active: boolean;
    user: IUser;
}

export function isLectureListResponse(response: any): response is ILectureListResponse {
    return response.lectures != null && response.futureLectures != null;
}

export interface ILectureListResponse2 {
    currentLectures: ILecture[];
    futureLectures: ILecture[];
    pastLectures: ILecture[];
}

export interface ILectureListResponse {
    isLecturer: boolean;
    lectures: ILecture[];
    futureLectures: ILecture[];
}

export interface ILectureResponse {
    isInLecture: boolean;
    isLecturer: boolean;
    lecture: ILecture;
    students: ILecturePerson[];
    lecturers: ILecturePerson[];
    useWall: boolean;
    useQuestions: boolean;
    correctPassword?: boolean;
}

export interface ILectureSettings {
    inLecture: boolean;
    lectureMode: boolean;
    useAnswers: boolean;
    useQuestions: boolean;
    useWall: boolean;
}

export function hasLectureEnded(lecture: ILecture) {
    return lecture.end_time < moment();
}

export interface IUniqueParId {
    parId: string;
    docId: number;
}

export type IUpdateResponse = IGotUpdatesResponse | INoUpdatesResponse | ILectureListResponse;

export interface IQuestionEndTimeChange {
    new_end_time: Moment | null;
}

export interface IPointsClosed {
    points_closed: true;
}

export interface IAlreadyAnswered {
    already_answered: true;
}

export interface IQuestionAsked {
    type: "question";
    data: IAskedQuestion;
}

export interface IQuestionHasAnswer {
    type: "answer";
    data: IQuestionAnswer;
}

export interface IQuestionResult {
    type: "result";
    data: IQuestionAnswer;
}

export type IExtraResponse =
    IQuestionEndTimeChange
    | IPointsClosed
    | IGetNewQuestionResponse;

export type IGetNewQuestionResponse =
    IAlreadyAnswered
    | IQuestionAsked
    | IQuestionResult
    | IQuestionHasAnswer
    | null;

export interface IGotUpdatesResponse {
    msgs: ILectureMessage[];
    lectureEnding: 1 | 5 | 100;
    lectureId: number;
    lecturers: ILecturePerson[];
    students: ILecturePerson[];
    ms: number;
    extra?: IExtraResponse;
}

export interface IEmptyResponse {
    empty: true;
}

export function isEmptyResponse(r: ILectureResponse | ILectureListResponse | IEmptyResponse): r is IEmptyResponse {
    return (r as IEmptyResponse).empty === true;
}

export interface INoUpdatesResponse {
    ms: number;
}

export function hasUpdates(r: IUpdateResponse): r is IGotUpdatesResponse {
    return (r as IGotUpdatesResponse).msgs != null;
}

export function endTimeChanged(r: IExtraResponse): r is IQuestionEndTimeChange {
    return (r as IQuestionEndTimeChange).new_end_time !== undefined; // can be null, so must check for undefined
}

export function pointsClosed(r: IExtraResponse): r is IPointsClosed {
    return (r as IPointsClosed).points_closed != null;
}

export function alreadyAnswered(r: IExtraResponse): r is IAlreadyAnswered {
    return (r as IAlreadyAnswered).already_answered != null;
}

export function questionAsked(r: IExtraResponse): r is IQuestionAsked {
    return (r as IQuestionAsked).type === "question";
}

export function questionAnswerReceived(r: IExtraResponse): r is IQuestionResult {
    return (r as IQuestionResult).type === "result";
}

export function questionHasAnswer(r: IExtraResponse): r is IQuestionHasAnswer {
    return (r as IQuestionHasAnswer).type === "answer";
}

export function isAskedQuestion(qa: IAskedQuestion | IQuestionAnswer): qa is IAskedQuestion {
    return (qa as IAskedQuestion).asked_id != null;
}

export type AnswerTable = string[][];
