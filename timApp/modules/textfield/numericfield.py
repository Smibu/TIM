"""
TIM plugin: a numericfield
"""

from typing import Union

import attr
from flask import jsonify, render_template_string, Blueprint
from marshmallow import Schema, fields, post_load
from marshmallow.utils import missing
from webargs.flaskparser import use_args

from common_schemas import TextfieldStateModel, TextfieldStateSchema
from pluginserver_flask import GenericMarkupModel, GenericMarkupSchema, GenericHtmlSchema, GenericHtmlModel, \
    GenericAnswerSchema, GenericAnswerModel, Missing, \
    InfoSchema, render_multihtml

numericfield_route = Blueprint('nf', __name__, url_prefix="/nf")


NumericfieldStateModel = TextfieldStateModel
NumericfieldStateSchema = TextfieldStateSchema


@attr.s(auto_attribs=True)
class NumericfieldMarkupModel(GenericMarkupModel):
    points_array: Union[str, Missing] = missing
    inputstem: Union[str, Missing] = missing
    initnumber: Union[float, Missing] = missing
    cols: Union[int, Missing] = missing
    inputplaceholder: Union[int, Missing] = missing
    tag: Union[str, Missing] = missing
    arrows: Union[bool, Missing] = missing
    wheel: Union[bool, Missing] = missing
    verticalkeys: Union[bool, Missing] = missing
    autosave: Union[bool, Missing] = missing
    validinput: Union[str, Missing] = missing
    errormessage: Union[str, Missing] = missing
    readOnlyStyle: Union[str, Missing] = missing
    step: Union[float, Missing] = missing
    nosave: Union[bool, Missing] = missing
    ignorestyles: Union[bool, Missing] = missing
    clearstyles: Union[bool, Missing] = missing


class NumericfieldMarkupSchema(GenericMarkupSchema):
    points_array = fields.List(fields.List(fields.Number()))
    header = fields.String(allow_none=True)
    inputstem = fields.String(allow_none=True)
    stem = fields.String(allow_none=True)
    initnumber = fields.Number(allow_none=True)
    cols = fields.Int()
    inputplaceholder = fields.Number(allow_none=True)
    tag = fields.String(allow_none=True)
    autosave = fields.Boolean()
    arrows = fields.Boolean()
    wheel = fields.Boolean()
    verticalkeys = fields.Boolean()
    validinput = fields.String(allow_none=True)
    errormessage = fields.String(allow_none=True)
    readOnlyStyle = fields.String(allow_none=True)
    step = fields.Number(allow_none=True)
    nosave = fields.Boolean()
    ignorestyles = fields.Boolean()
    clearstyles = fields.Boolean()

    @post_load
    def make_obj(self, data):
        return NumericfieldMarkupModel(**data)


@attr.s(auto_attribs=True)
class NumericfieldInputModel:
    """Model for the information that is sent from browser (plugin AngularJS component)."""
    c: float = missing
    nosave: bool = missing


class NumericfieldInputSchema(Schema):
    c = fields.Number(allow_none=True)
    nosave = fields.Bool()

    @post_load
    def make_obj(self, data):
        return NumericfieldInputModel(**data)


class NumericfieldAttrs(Schema):
    """Common fields for HTML and answer routes."""
    markup = fields.Nested(NumericfieldMarkupSchema)
    state = fields.Nested(NumericfieldStateSchema, allow_none=True, required=True)


@attr.s(auto_attribs=True)
class NumericfieldHtmlModel(GenericHtmlModel[NumericfieldInputModel, NumericfieldMarkupModel, NumericfieldStateModel]):
    def get_component_html_name(self) -> str:
        return 'numericfield-runner'

    def get_static_html(self) -> str:
        return render_static_numericfield(self)


class NumericfieldHtmlSchema(NumericfieldAttrs, GenericHtmlSchema):
    info = fields.Nested(InfoSchema, allow_none=True, required=True)

    @post_load
    def make_obj(self, data):
        # noinspection PyArgumentList
        return NumericfieldHtmlModel(**data)


@attr.s(auto_attribs=True)
class NumericfieldAnswerModel(GenericAnswerModel[NumericfieldInputModel,
                                                 NumericfieldMarkupModel, NumericfieldStateModel]):
    pass


class NumericfieldAnswerSchema(NumericfieldAttrs, GenericAnswerSchema):
    input = fields.Nested(NumericfieldInputSchema, required=True)

    @post_load
    def make_obj(self, data):
        # noinspection PyArgumentList
        return NumericfieldAnswerModel(**data)


def render_static_numericfield(m: NumericfieldHtmlModel):
    return render_template_string("""
<div>
<h4>{{ header or '' }}</h4>
<p class="stem">{{ stem or '' }}</p>
<div><label>{{ inputstem or '' }} <span>
<input type="text"
class="form-control"
placeholder="{{ inputplaceholder or '' }}"
size="{{cols}}"></span></label>
</div>
<button class="timButton">
{{ buttonText or button or "Save" }}
</button>
<a>{{ resetText }}</a>
<p class="plgfooter">{{ '' }}</p>
</div>""".strip(),
        **attr.asdict(m.markup),
    )


NUMERIC_FIELD_HTML_SCHEMA = NumericfieldHtmlSchema()


@numericfield_route.route('/multihtml/', methods=['post'])
@use_args(GenericHtmlSchema(many=True), locations=("json",))
def nf_multihtml(args):  # args: List[GenericHtmlSchema]):
    ret = render_multihtml(NUMERIC_FIELD_HTML_SCHEMA, args)
    return ret


@numericfield_route.route('/answer/', methods=['put'])
@use_args(NumericfieldAnswerSchema(), locations=("json",))
def answer(args: NumericfieldAnswerModel):
    web = {}
    result = {'web': web}
    c = args.input.c
    nosave = args.input.nosave

    if isinstance(c, Missing):
        web['result'] = "unsaved"
        web['error'] = "Please enter a number"
        nosave = True

    if not nosave:
        save = {"c": c}
        if not args.markup.clearstyles and args.state is not None:
            if args.state.styles:
                save = {"c": c, "styles": args.state.styles}
        result["save"] = save
        web['result'] = "saved"
        if args.markup.clearstyles:
            web['clear'] = True

    return jsonify(result)


@numericfield_route.route('/reqs/')
@numericfield_route.route('/reqs')
def reqs():
    """Introducing templates for numericfield plugin"""
    templates = ["""``` {#PLUGINNAMEHERE plugin="numericfield"}
header:          # otsikko, tyhjä = ei otsikkoa
stem:            # kysymys, tyhjä = ei kysymystä
step:            # numeraalinen askellus, tyhjä = oletus 1.0
inputstem:       # vastaus, tyhjä = ei vastausta
tag:        # seurantaid, tyhjä = ei seurantaid:tä
initnumber:      # alkuarvo, tyhjä = ei alkuarvoa
buttonText: Save # painikkeen nimi, tyhjä = ei painiketta
cols: 7          # kentän koko, numeraalinen
autosave: false  # autosave, pois päältä
validinput: "^\d{0,3}(\.\d{0,3})?$" # käyttäjäsyötteen rajoitin, tyhjä = ei rajoitusta
errormessage:    # inputcheckerin virheselite, tyhjä = selite on inputchecker
```""", """#- {defaultplugin=\"numericfield\" readonly=\"view\"}
{% set name,n = 'd', 5 %}
%% ('{{#'+name+'{0} stem: \"{0}\", autosave: true, readOnlyStyle: plaintext#}}') | srange(1,n+1) -%%
{#%%name%%sum stem: summa, autosave: true, readOnlyStyle: plaintext#} 
""", ]
    return jsonify({
        "js": ["/field/js/build/numericfield.js"],
        "multihtml": True,
        "css": ["/field/css/field.css"],
        'editor_tabs': [
            {
                'text': 'Fields',
                'items': [
                    {
                        'text': 'Numeric',
                        'items': [
                            {
                                'data': '#- {defaultplugin="numericfield" readonly="view" .fieldCell}',
                                'text': 'defaultplugin/numericfield',
                                'expl': 'Attribuutit kappaleelle jossa inline numericfield',
                            },
                            {
                                'data': "%% 'd;dsum' | gfrange(1,5,'autosave: true, cols: 3') %%",
                                'text': 'Joukko kenttiä',
                                'expl': 'Valmis joukko samannimisiä kenttä',
                            },
                            {
                                'data': '{#nf1 autosave: true #}',
                                'text': 'Numeerinen kenttä (inline, autosave)',
                                'expl': 'Luo kenttä jonka syötteet ovat vain numeroita',
                            },
                            {
                                'data': templates[0].strip(),
                                'text': 'Numeerinen kenttä (laajennettu)',
                                'expl': 'Luo kenttä jonka syötteet ovat vain numeroita',
                            },
                            {
                                'data': "{#nf3 readOnlyStyle: plaintext #}",
                                'text': 'Label kenttä (read only)',
                                'expl': 'Luo kenttä jonka syötteitä käyttäjä ei voi muokata',
                            },
                            {
                                'data': templates[1].strip(),
                                'text': 'Joukko numeerisia kenttiä ja summa',
                                'expl': 'Lohko jossa joukko numeerisia kenttiä ja niiden summa',
                            },
                        ],
                    },
                ],
            },
        ],
    },
    )
