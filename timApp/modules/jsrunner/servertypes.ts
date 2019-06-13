import * as t from "io-ts";
import {JsrunnerMarkup} from "./public/javascripts/jsrunnertypes";

export const UserFieldData = t.type({
    fields: t.record(t.string, t.unknown),
    user: t.type({id: t.Int, name: t.string, real_name: t.string}),
});

export type UserFieldDataT = t.TypeOf<typeof UserFieldData>;

export const AliasData = t.record(t.string, t.string);

export type AliasDataT = t.TypeOf<typeof AliasData>;

export const JsrunnerAnswer = t.type({
    markup: JsrunnerMarkup,
    input: t.type({
        data: t.array(UserFieldData),
        aliases: AliasData,
    }),
    taskID: t.string,
});
