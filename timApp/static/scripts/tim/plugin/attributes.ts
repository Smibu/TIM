/*
This module contains io-ts type definitions that are intended to be used in both client and server code.
So, do NOT import anything client-side-specific (like AngularJS) in this module or use any DOM types (Element, etc.).
*/

import * as t from "io-ts";

export const undoType = t.partial({
    button: nullable(t.string),
    title: nullable(t.string),
    confirmation: nullable(t.string),
});

// Attributes that are valid for all plugins.
export const GenericPluginMarkup = t.partial({
    answerLimit: t.Integer,
    button: nullable(t.string),
    buttonText: nullable(t.string),
    disableUnchanged: t.boolean,
    footer: t.string,
    header: nullable(t.string),
    lazy: t.boolean,
    resetText: nullable(t.string),
    stem: nullable(t.string),
    hideBrowser: t.boolean,
    forceBrowser: t.boolean,
    undo: nullable(undoType),
    useCurrentUser: t.boolean,
    connectionErrorMessage: nullable(t.string),
});

export const Info = nullable(t.type({
    // TODO add the rest of the fields
    earlier_answers: t.Integer,
}));

export function getTopLevelFields<M extends IGenericPluginMarkup>(m: t.Type<M>) {
    return t.intersection([
        t.partial({
            access: t.keyof({
                readonly: null,
                readwrite: null,
            }),
            state: t.unknown,
        }),
        t.type({
            info: Info,
            preview: t.boolean,
            markup: m,
        }),
    ]);
}

const UnknownTopLevel = getTopLevelFields(GenericPluginMarkup);

export interface IGenericPluginTopLevelFields<MarkupType extends IGenericPluginMarkup> extends t.TypeOf<typeof UnknownTopLevel> {
    markup: MarkupType;
}

export interface IGenericPluginMarkup extends t.TypeOf<typeof GenericPluginMarkup> {
    // should be empty
}

// from https://github.com/teamdigitale/italia-ts-commons/blob/de4d85a2a1502da54f78aace8c6d7b263803f115/src/types.ts
export function withDefault<T extends t.Any>(
    type: T,
    defaultValue: t.TypeOf<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): t.Type<t.TypeOf<T>, any> {
    return new t.Type(
        type.name,
        (v: unknown): v is T => type.is(v),
        (v: unknown, c: t.Context) =>
            type.validate(v !== undefined && v !== null ? v : defaultValue, c),
        (v: unknown) => type.encode(v) as t.TypeOf<T>,
    );
}

export function nullable<T extends t.Any>(type: T) {
    return t.union([t.null, type]);
}

export const IncludeUsersOption = t.keyof({current: null, all: null, deleted: null});
