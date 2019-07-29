"""
TIM example plugin: a ImportData
"""
import json
import os
from typing import Union, List
from flask import abort

import attr
from timApp.plugin.containerLink import get_plugin
import requests

from flask import jsonify, render_template_string
from marshmallow import Schema, fields, post_load
from marshmallow.utils import missing
from webargs.flaskparser import use_args

from pluginserver_flask import GenericMarkupModel, GenericMarkupSchema, GenericHtmlSchema, GenericHtmlModel, \
    GenericAnswerSchema, GenericAnswerModel, Missing, \
    InfoSchema, create_blueprint
from timApp.tim_app import csrf
from timApp.user.user import User


@attr.s(auto_attribs=True)
class ImportDataStateModel:
    """Model for the information that is stored in TIM database for each answer."""
    url: Union[str, Missing] = None
    separator: Union[str, Missing] = None
    fields: Union[List[str], Missing] = None

class ImportDataStateSchema(Schema):
    url = fields.Str(allow_none=True)
    separator = fields.Str(allow_none=True)
    fields = fields.List(fields.Str()) # Keep this last

    @post_load
    def make_obj(self, data):
        res = ImportDataStateModel(**data)
        return res


@attr.s(auto_attribs=True)
class ImportDataMarkupModel(GenericMarkupModel):
    buttonText: Union[str, Missing] = missing
    docid: Union[int, Missing] = missing
    open: Union[bool, Missing] = missing
    borders: Union[bool, Missing] = missing
    upload: Union[bool, Missing] = missing
    useurl: Union[bool, Missing] = missing
    useseparator: Union[bool, Missing] = missing
    usefields: Union[bool, Missing] = missing
    uploadstem: Union[str, Missing] = missing
    urlstem: Union[str, Missing] = missing
    loadButtonText: Union[str, Missing] = missing
    url: Union[str, Missing] = missing
    beforeOpen: Union[str, Missing] = missing
    separator: Union[str, Missing] = missing
    prefilter: Union[str, Missing] = missing
    placeholder: Union[str, Missing] = missing
    fields: Union[List[str], Missing] = missing



class ImportDataMarkupSchema(GenericMarkupSchema):
    buttonText = fields.Str(allow_none=True)
    docid = fields.Int(allow_none=True)
    open = fields.Bool(allow_none=True)
    borders = fields.Bool(allow_none=True)
    upload = fields.Bool(allow_none=True)
    useurl = fields.Bool(allow_none=True)
    useseparator = fields.Bool(allow_none=True)
    usefields = fields.Bool(allow_none=True)
    uploadstem = fields.Str(allow_none=True)
    urlstem = fields.Str(allow_none=True)
    loadButtonText = fields.Str(allow_none=True)
    url = fields.Str(allow_none=True)
    beforeOpen = fields.Str(allow_none=True)
    separator = fields.Str(allow_none=True)
    prefilter = fields.Str(allow_none=True)
    placeholder = fields.Str(allow_none=True)
    fields = fields.List(fields.Str()) # Keep this last


    @post_load
    def make_obj(self, data):
        return ImportDataMarkupModel(**data)


@attr.s(auto_attribs=True)
class ImportDataInputModel:
    """Model for the information that is sent from browser (plugin AngularJS component)."""
    data: str
    separator: str
    url: str
    fields: Union[List[str], Missing] = missing

class ImportDataInputSchema(Schema):
    data = fields.Str(required=True)
    separator = fields.Str(required=False)
    url = fields.Str(required=False)
    fields = fields.List(fields.Str()) # Keep this last

    @post_load
    def make_obj(self, data):
        return ImportDataInputModel(**data)


class ImportDataAttrs(Schema):
    """Common fields for HTML and answer routes."""
    markup = fields.Nested(ImportDataMarkupSchema)
    state = fields.Nested(ImportDataStateSchema, allow_none=True, required=True)


@attr.s(auto_attribs=True)
class ImportDataHtmlModel(GenericHtmlModel[ImportDataInputModel, ImportDataMarkupModel, ImportDataStateModel]):
    def get_component_html_name(self) -> str:
        return 'importdata-runner'

    def show_in_view_default(self) -> bool:
        return False

    def get_static_html(self) -> str:
        s = self.markup.beforeOpen or "+ Open Import"
        return render_static_import_data(self, s)

    def get_browser_json(self):
        r = super().get_browser_json()
        # r['state']['separator'] = ";"
        return r


class ImportDataHtmlSchema(ImportDataAttrs, GenericHtmlSchema):
    info = fields.Nested(InfoSchema, allow_none=True, required=True)

    @post_load
    def make_obj(self, data):
        # noinspection PyArgumentList
        return ImportDataHtmlModel(**data)


@attr.s(auto_attribs=True)
class ImportDataAnswerModel(GenericAnswerModel[ImportDataInputModel, ImportDataMarkupModel, ImportDataStateModel]):
    pass


class ImportDataAnswerSchema(ImportDataAttrs, GenericAnswerSchema):
    input = fields.Nested(ImportDataInputSchema, required=False)

    @post_load
    def make_obj(self, data):
        # noinspection PyArgumentList
        return ImportDataAnswerModel(**data)


def render_static_import_data(m: ImportDataHtmlModel, s: str):
    return render_template_string(
        f"""
<div class="ImportData">
 {s}
</div>
<br>
        """,
        **attr.asdict(m.markup),
    )


importData_plugin = create_blueprint(__name__, 'importData', ImportDataHtmlSchema(), csrf)

def conv_data_csv(data, field_names, separator):
    """
    Convert csv format "akankka;1,2,3" to TIM-format ["akankka;d1;1", "akankks;d2;2" ...]
    using field names.  If there is too less fields on data, only those
    are used.  If there is more columns in data thatn fields, omit extra columns
    :param data: data in csv-format to convert
    :param field_names: list of filednames to use for columns
    :param separator: separator to use to separate items
    :return: converted data in TIM-format
    """
    res = []
    for r in data:
        parts = r.split(separator)
        if len(parts) < 2:
            continue
        row = f"{parts[0]}"
        for i in range(1, len(parts)):
            if i-1 >= len(field_names):
                break
            name = field_names[i-1].strip()
            row += f"{separator}{name}{separator}{parts[i]}"
        res.append(row)
    return res


def conv_data_field_names(data, field_names, separator):
    """
    Convert field names on TIM-format akankka;demo;2 so that demo is changes if
    found from field_names
    :param data: data to convert
    :param field_names: lits off fileds ana aliases in format "demo=d1"
    :param separator: separator for items
    :return: converted data
    """
    fconv = {}
    res = []
    use_all = False
    for fn in field_names:
        pcs = fn.split("=")
        ffrom = pcs[0].strip()
        fto = ffrom
        if len(pcs) >= 2:
            fto = pcs[1].strip()
        if ffrom == '*':
            use_all = True
        else:
            fconv[ffrom] = fto
    for r in data:
        parts = r.split(separator)
        if len(parts) < 3:
            continue
        row = f"{parts[0]}"
        for i in range(1, len(parts)-1, 2):
            tname = parts[i]
            name = fconv.get(tname, tname)
            value = parts[i+1]
            row += (f"{separator}{name}{separator}{value}")

        res.append(row)
    return res


def convert_data(data, field_names, separator):
    """
    If there is field_names, then convert data either by changing names (field_names has =)
    or csv data
    :param data: data to convert
    :param field_names: list of fieldnames or fieldnames and aliases
    :param separator: separator to use between items
    :return: converted data or data as it is
    """
    if not field_names or len(field_names) <= 0:
        return data
    f0 = field_names[0]
    if f0.find("=") > 0: # convert names
       return conv_data_field_names(data, field_names, separator)
    return conv_data_csv(data, field_names, separator)


@importData_plugin.route('/answer/', methods=['put'])
@csrf.exempt
@use_args(ImportDataAnswerSchema(), locations=("json",))
def answer(args: ImportDataAnswerModel):
    sdata = args.input.data
    defaultseparator = args.markup.separator or ";"
    separator = args.input.separator or defaultseparator
    data = sdata.split("\n")
    output = ""
    field_names = args.input.fields
    data = convert_data(data, field_names, separator)
    if args.markup.prefilter:
        params = {'code': args.markup.prefilter, 'data': data}
        runurl = get_plugin('jsrunner').get("host") + 'runScript/'
        r = requests.request('post', runurl, data=params)
        result = json.loads(r.text)
        error = result.get('error', '')
        if error:
            abort(400, error)
        data = result.get("result",[])
        output = result.get("output", "")
    did = int(args.taskID.split(".")[0])
    if args.markup.docid:
        did = args.markup.docid
    rows = []
    wrong = 0
    wrongs = ""
    for r in data:
        if not r:
            continue
        parts = r.split(separator)
        u = None
        error = ": unknown name"
        if len(parts) >= 3:
            u = User.get_by_name(parts[0])
        else:
            error = ": too few parts"
        if not u:
            wrong += 1
            wrongs += "\n" + r + error
            continue
        uid = u.id
        ur = { 'user': uid, 'fields': {}}
        for i in range(1, len(parts)-1, 2):
            tname = parts[i]
            value = parts[i+1]
            if tname.find('.') < 0:
                tname = f"{did}.{tname}"
            ur['fields'][tname] = value
        rows.append(ur)

    if output:
        output = output + "\n"

    if wrong:
        wrongs = "\nWrong lines: " + str(wrong) + "\n" + wrongs
    jsonresp = { 'savedata': rows,
                 'web' : { 'result': output + "Imported " + str(len(rows)) + wrongs} }

    save = {}

    if args.input.url != args.markup.url or \
            (args.state and args.state.url and args.state.url != args.input.url):
        save['url'] = args.input.url

    if separator != defaultseparator or \
            (args.state and args.state.separator and args.state.separator != separator):
        save['separator'] = separator
    if not field_names:
        field_names = []
    if not args.markup.fields:
        args.markup.fields = []
    if field_names != args.markup.fields:
        save['fields'] = field_names
    if save:
        jsonresp["save"] = save
    # ret = handle_jsrunner_response(jsonresp, result, current_doc)
    # save = saveRows
    # result["save"] = save
    return jsonify(jsonresp)


@importData_plugin.route('/reqs/')
@importData_plugin.route('/reqs')
def reqs():
    """Introducing templates for ImportData plugin"""
    templates = ["""
``` {#ImportData plugin="importData"}
buttonText: Import
```"""]
    editor_tabs = [
            {
                'text': 'Fields',
                'items': [
                    {
                        'text': 'Save/Import',
                        'items': [
                            {
                                'data': templates[0].strip(),
                                'text': 'Import data',
                                'expl': 'Import data from text',
                            },
                        ],
                    },
                ],
            },
        ]
    if os.environ.get('SHOW_TEMPLATES', "True") == "False":
        editor_tabs = None
    return jsonify({
        "js": [],
        "multihtml": True,
        'editor_tabs': editor_tabs,
    },
    )
