import html
import re
from copy import deepcopy
from datetime import datetime, timezone
from typing import Tuple, Optional, Union, Iterable, Dict, NamedTuple, Generator, List, Match

import yaml

import timApp
from timApp.answer.answer import Answer
from timApp.document.docparagraph import DocParagraph
from timApp.document.document import Document
from timApp.document.macroinfo import MacroInfo
from timApp.document.yamlblock import strip_code_block, YamlBlock, merge
from timApp.markdown.markdownconverter import expand_macros
from timApp.plugin.pluginOutputFormat import PluginOutputFormat
from timApp.plugin.pluginexception import PluginException
from timApp.plugin.taskid import TaskId, UnvalidatedTaskId, MaybeUnvalidatedTaskId
from timApp.printing.printsettings import PrintFormat
from timApp.timdb.exceptions import TimDbException
from timApp.user.user import User
from timApp.util.rndutils import get_simple_hash_from_par_and_user
from timApp.util.utils import try_load_json, get_current_time, Range

date_format = '%Y-%m-%d %H:%M:%S'
AUTOMD = 'automd'

LAZYSTART = "<!--lazy "
LAZYEND = " lazy-->"
NOLAZY = "<!--nolazy-->"
NEVERLAZY = "NEVERLAZY"


class PluginRenderOptions(NamedTuple):
    user: Optional[User]
    do_lazy: bool
    user_print: bool
    preview: bool
    target_format: PrintFormat
    output_format: PluginOutputFormat
    review: bool
    wrap_in_div: bool

    @property
    def is_html(self):
        return self.output_format == PluginOutputFormat.HTML


def get_value(values, key, default=None):
    """
    Gets the value either from key or -key
    :param values: dict where to find
    :param key: key to use
    :param default: value returned if key not found from either of key or -key
    :return: value for key, -key or default
    """
    if not values:
        return default
    if key in values:
        return values.get(key, default)
    if '-' + key in values:
        return values.get('-' + key, default)
    return default


def get_num_value(values, key, default=None):
    """
    Gets the value either from key or -key
    :param values: dict where to find
    :param key: key to use
    :param default: value returned if key not found from either of key or -key
    :return: value for key, -key or default
    """
    value = get_value(values, key, default)
    # noinspection PyBroadException
    try:
        value = float(value)
    except:
        value = default
    return value


class Plugin:
    deadline_key = 'deadline'
    starttime_key = 'starttime'
    points_rule_key = 'pointsRule'
    answer_limit_key = 'answerLimit'
    limit_defaults = {'mmcq': 1, 'mmcq2': 1, 'mcq': 1, 'mcq2': 1}

    def __init__(self, task_id: Optional[TaskId],
                 values: dict,
                 plugin_type: str,
                 par: Optional[DocParagraph] = None):
        self.answer: Optional[Answer] = None
        self.answer_count = None
        self.options: PluginRenderOptions = None
        self.task_id = task_id
        if task_id and (task_id.doc_id == par.doc.doc_id or not task_id.doc_id):
            # self.task_id = TaskId.parse(task_id, require_doc_id=False)
            # TODO check if par can be None here
            self.task_id.doc_id = par.ref_doc.doc_id if par.ref_doc else par.doc.doc_id
            self.task_id.block_id_hint = par.get_id()
        assert isinstance(values, dict)
        self.values = values
        self.type = plugin_type
        self.par = par
        self.points_rule_cache = None  # cache for points rule
        self.output = None
        self.plugin_lazy = None

    # TODO don't set task_id in HTML or JSON at all if there isn't one.
    #  Currently at least csPlugin cannot handle taskID being None.
    @property
    def fake_task_id(self):
        return f'{self.par.doc.doc_id}..{self.par.get_id()}'

    @staticmethod
    def get_date(d):
        if isinstance(d, str):
            try:
                d = datetime.strptime(d, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                raise PluginException(f'Invalid date format: {d}')
        if isinstance(d, datetime):
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
        elif d is not None:
            raise PluginException(f'Invalid date format: {d}')
        return d

    @staticmethod
    def from_task_id(task_id: str, user: User):
        tid = TaskId.parse(task_id)
        doc = Document(tid.doc_id)
        doc.insert_preamble_pars()
        return find_plugin_from_document(doc, tid, user)

    @staticmethod
    def from_paragraph(par: DocParagraph, user: Optional[User] = None):
        doc = par.doc
        if not par.is_plugin():
            raise PluginException(f'The paragraph {par.get_id()} is not a plugin.')
        task_id_name = par.get_attr('taskId')
        plugin_name = par.get_attr('plugin')
        rnd_seed = get_simple_hash_from_par_and_user(par, user)  # TODO: RND_SEED get users rnd_seed for this plugin
        par.insert_rnds(rnd_seed)
        plugin_data = parse_plugin_values(par,
                                          global_attrs=doc.get_settings().global_plugin_attrs(),
                                          macroinfo=doc.get_settings().get_macroinfo(user))
        p = Plugin(
            TaskId.parse(task_id_name, require_doc_id=False, allow_block_hint=False) if task_id_name else None,
            plugin_data,
            plugin_name,
            par=par,
        )
        return p

    def deadline(self, default=None):
        return self.get_date(get_value(self.values, self.deadline_key, default)) or default

    def starttime(self, default=None):
        return self.get_date(get_value(self.values, self.starttime_key, default)) or default

    def points_rule(self):
        if self.points_rule_cache is None:
            self.points_rule_cache = get_value(self.values, self.points_rule_key, {})
            if not isinstance(self.points_rule_cache, dict):
                self.points_rule_cache = {}
        return self.points_rule_cache

    def max_points(self, default=None):
        return self.points_rule().get('maxPoints', default)

    def user_min_points(self, default=None):
        return self.points_rule().get('allowUserMin', default)

    def user_max_points(self, default=None):
        return self.points_rule().get('allowUserMax', default)

    def answer_limit(self):
        return get_value(self.values, self.answer_limit_key, self.limit_defaults.get(self.type))

    def points_multiplier(self, default=1):
        return self.points_rule().get('multiplier', default)

    def validate_points(self, points: Union[str, float]):
        try:
            points = float(points)
        except (ValueError, TypeError):
            raise PluginException('Invalid points format.')
        points_min = self.user_min_points()
        points_max = self.user_max_points()
        if points_min is None or points_max is None:
            raise PluginException('You cannot give yourself custom points in this task.')
        elif not (points_min <= points <= points_max):
            raise PluginException(f'Points must be in range [{points_min},{points_max}]')
        return points

    def to_paragraph(self) -> DocParagraph:
        text = '```\n' + yaml.dump(self.values, allow_unicode=True, default_flow_style=False) + '\n```'
        attrs = {}
        if self.par:
            attrs = self.par.attrs
        if self.task_id:
            attrs['task_id'] = self.task_id.task_name
        attrs['plugin'] = self.type

        return DocParagraph.create(self.par.doc, par_id=self.par.get_id(), md=text, attrs=attrs)

    def set_value(self, key: str, value):
        self.values[key] = value
        return self

    def save(self):
        self.to_paragraph().save()

    def get_info(self, users: Iterable[User], old_answers: int, look_answer: bool = False, valid: bool = True):
        user_ids = ';'.join([u.name for u in users])
        from timApp.auth.sessioninfo import get_current_user_object
        return {
            # number of earlier answers
            # TODO: this is None when browsing answers with answer browser; should determine the number of answers
            # posted before the current one
            'earlier_answers': old_answers,
            'max_answers': self.answer_limit(),
            'current_user_id': get_current_user_object().name,
            'user_id': user_ids,
            # indicates whether we are just looking at an answer, not actually posting a new one
            'look_answer': look_answer,
            'valid': valid
        }

    def set_render_options(self, answer: Optional[Tuple[Answer, int]], options: PluginRenderOptions):
        if answer:
            self.answer, self.answer_count = answer
        self.options = options

    def render_json(self):
        options = self.options
        if self.answer is not None:
            state = try_load_json(self.answer.content)
            # if isinstance(state, dict) and options.user is not None:
            if options.user is not None:
                info = self.get_info([options.user], old_answers=self.answer_count, valid=self.answer.valid)
            else:
                info = None
        else:
            state = None
            info = None
        return {"markup": self.values,
                "state": state,
                "taskID": self.task_id.doc_task if self.task_id else self.fake_task_id,
                "taskIDExt": self.task_id.extended_or_doc_task if self.task_id else self.fake_task_id,
                "doLazy": options.do_lazy,
                "userPrint": options.user_print,
                # added preview here so that whether or not the window is in preview can be
                # checked in python so that decisions on what data is sent can be made.
                "preview": options.preview,
                "anonymous": options.user is not None,
                "info": info,
                "user_id": options.user.name if options.user is not None else 'Anonymous',
                "targetFormat": options.target_format.value,
                "review": options.review,
                }

    def is_answer_valid(self, old_answers, tim_info):
        """Determines whether the currently posted answer should be considered valid.

        :param old_answers: The number of old answers for this task for the current user.
        :param tim_info: The tim_info structure returned by the plugin or empty object.
        :return: True if the answer should be considered valid, False otherwise.

        """
        answer_limit = self.answer_limit()
        if answer_limit is not None and (answer_limit <= old_answers):
            return False, 'You have exceeded the answering limit.'
        if self.starttime(default=datetime(1970, 1, 1, tzinfo=timezone.utc)) > get_current_time():
            return False, 'You cannot submit answers yet.'
        if self.deadline(default=datetime.max.replace(tzinfo=timezone.utc)) < get_current_time():
            return False, 'The deadline for submitting answers has passed.'
        if tim_info.get('notValid', None):
            return False, 'Answer is not valid'
        return True, 'ok'

    def can_give_task(self):
        plugin_class = timApp.plugin.containerLink.get_plugin(self.type)
        return plugin_class.get('canGiveTask', False)

    def is_cached(self):
        cached = self.values.get('cache', None)
        if cached:
            return True
        if cached is not None:
            return False
        return self.values.get('gvData', False)  # Graphviz is cached if not cacahe: false attribute

    def is_lazy(self) -> bool:
        do_lazy = self.options.do_lazy
        plugin_lazy = self.plugin_lazy
        html = self.output
        if do_lazy == NEVERLAZY:
            return False
        markup = self.values
        markup_lazy = markup.get("lazy", "")
        if markup_lazy == False:
            return False  # user do not want lazy
        if self.is_cached():
            return False  # cache never lazy
        if not do_lazy and markup_lazy != True:
            return False
        if html is not None and html.find(NOLAZY) >= 0:
            return False  # not allowed to make lazy
        if markup_lazy == True:
            return True  # user wants lazy
        if plugin_lazy == False:
            return False
        return True

    def is_automd_enabled(self, default=False):
        return self.values.get(AUTOMD, default)

    def set_output(self, output: str):
        self.output = output

    def get_answerbrowser_type(self):
        if self.is_cached():
            return None
        # Some plugins don't have answers but they may still need to be loaded lazily.
        # We sometimes want answerbrowser for graphviz too, so we don't exclude it here.
        if self.type.startswith('show'):
            return 'lazyonly' if self.is_lazy() else None
        return 'full'

    def get_container_class(self):
        return f'plugin{self.type}'

    def get_wrapper_tag(self):
        return 'div'

    def get_final_output(self):
        out = self.output
        if self.is_lazy() and out.find(LAZYSTART) < 0:
            markup = self.values
            header = str(markup.get("header", markup.get("headerText", "")))
            stem = str(markup.get("stem", "Open plugin"))
            out = out.replace("<!--", "<!-LAZY-").replace("-->", "-LAZY->")
            out = f'{LAZYSTART}{out}{LAZYEND}<span style="font-weight:bold">{header}</span><div><p>{stem}</p></div>'
        answer_attr = ''

        # Create min and max height for div
        style = ''
        mh = self.values.get('-min-height', 0)
        if mh:
            style = f'min-height:{html.escape(str(mh))};'
        mh = self.values.get('-max-height', 0)
        if mh:
            style += f'max-height:{html.escape(str(mh))};overflow-y:auto;'
        if style:
            style = f'style="{style}"'

        plgclass = f'class="{self.get_container_class()}"'

        if self.answer:
            answer_attr = f""" answer-id='{self.answer.id}'"""
        html_task_id = self.task_id.extended_or_doc_task if self.task_id else self.fake_task_id
        tag = self.get_wrapper_tag()
        return f"<{tag} id='{html_task_id}'{answer_attr} data-plugin='/{self.type}' {plgclass} {style}>{out}</{tag}>" if self.options.wrap_in_div else out


def parse_plugin_values_macros(par: DocParagraph,
                               global_attrs: Dict[str, str],
                               macros: Dict[str, object],
                               macro_delimiter: str) -> Dict:
    """
    Parses the markup values for a plugin paragraph, taking document attributes and macros into account.

    :param par: The plugin paragraph.
    :param global_attrs: Global (Document) attributes.
    :param macros: Dict of macros
    :type macro_delimiter: delimiter for macros
    :return: The parsed markup values.
    """
    yaml_str = expand_macros_for_plugin(par, macros, macro_delimiter)
    return load_markup_from_yaml(yaml_str, global_attrs, par.get_attr('plugin'))


def expand_macros_for_plugin(par: DocParagraph, macros, macro_delimiter):
    par_md = par.get_markdown()
    rnd_macros = par.get_rands()
    if rnd_macros:
        macros = {**macros, **rnd_macros}
    yaml_str = strip_code_block(par_md)
    if not par.get_nomacros():
        yaml_str = expand_macros(yaml_str,
                                 macros=macros,
                                 settings=par.doc.get_settings(),
                                 macro_delimiter=macro_delimiter)
    return yaml_str


def load_markup_from_yaml(yaml_str: str, global_attrs: Dict[str, str], plugin_type: str):
    try:
        values = YamlBlock.from_markdown(yaml_str).values
    except Exception:
        raise PluginException("YAML is malformed: " + yaml_str)
    if global_attrs:
        if isinstance(global_attrs, str):
            raise PluginException('global_plugin_attrs should be a dict, not str')
        global_attrs = deepcopy(global_attrs)
        final_values = global_attrs.get('all', {})
        merge(final_values, global_attrs.get(plugin_type, {}))
        merge(final_values, values)
        values = final_values
    return values


def parse_plugin_values(par: DocParagraph,
                        global_attrs: Dict[str, str],
                        macroinfo: MacroInfo) -> Dict:
    return parse_plugin_values_macros(par, global_attrs, macroinfo.get_macros(), macroinfo.get_macro_delimiter())


def find_inline_plugins(block: DocParagraph, macroinfo: MacroInfo) -> Generator[
    Tuple[MaybeUnvalidatedTaskId, Optional[str], Range, Optional[str], str], None, None]:
    md = block.get_expanded_markdown(macroinfo=macroinfo)

    # "}" not allowed in inlineplugins for now
    # TODO make task id optional
    matches: List[Match] = re.finditer(r'{#((\d+)\.)?([a-zA-Z0-9_-]+)(\.([a-z]+))?(:([a-zA-Z]+))?([ \n][^}]+)?}', md)
    for m in matches:
        task_doc = m.group(2)
        task_name = m.group(3)
        field_access = m.group(5)
        try:
            task_id = TaskId(
                doc_id=int(task_doc) if task_doc else None,
                task_name=task_name,
                block_id_hint=None,
                field=field_access,
            )
        except PluginException:
            task_id = UnvalidatedTaskId(
                doc_id=int(task_doc) if task_doc else None,
                task_name=task_name,
                block_id_hint=None,
                field=field_access,
            )
        plugin_type = m.group(7)
        p_yaml = m.group(8)
        p_range = (m.start(), m.end())
        yield task_id, p_yaml, p_range, plugin_type, md


def maybe_get_plugin_from_par(p: DocParagraph, task_id: TaskId, u: User) -> Optional[Plugin]:
    tid_attr = p.get_attr('taskId')
    if (tid_attr == task_id.task_name or (task_id.doc_id and tid_attr == task_id.doc_task)) and p.get_attr('plugin'):
        return Plugin.from_paragraph(p, user=u)
    def_plug = p.get_attr('defaultplugin')
    if def_plug:
        settings = p.doc.get_settings()
        for p_task_id, p_yaml, p_range, plugin_type, md in find_inline_plugins(block=p,
                                                                               macroinfo=settings.get_macroinfo(user=u)):
            p_task_id.validate()
            if p_task_id.task_name != task_id.task_name:
                continue
            plugin_type = plugin_type or def_plug
            y = load_markup_from_yaml(finalize_inline_yaml(p_yaml), settings.global_plugin_attrs(), plugin_type)
            return InlinePlugin(
                task_id=p_task_id,
                values=y,
                plugin_type=plugin_type,
                p_range=p_range,
                par=p,
            )
    return None


def find_plugin_from_document(d: Document, task_id: TaskId, u: User):
    with d.__iter__() as it:
        for p in it:
            if task_id.block_id_hint and p.get_id() != task_id.block_id_hint:
                continue
            if p.is_reference():
                try:
                    ref_pars = p.get_referenced_pars()
                except TimDbException:  # Ignore invalid references
                    continue
                else:
                    for rp in ref_pars:
                        plug = maybe_get_plugin_from_par(rp, task_id, u)
                        if plug:
                            return plug
            plug = maybe_get_plugin_from_par(p, task_id, u)
            if plug:
                return plug

    raise TimDbException(f'Task not found in the document: {task_id.task_name}')


class InlinePlugin(Plugin):
    def __init__(
            self,
            task_id: Optional[TaskId],
            values: dict,
            plugin_type: str,
            p_range: Range,
            par: Optional[DocParagraph] = None,
    ):
        super().__init__(task_id, values, plugin_type, par)
        self.range = p_range

    def get_container_class(self):
        return f'{super().get_container_class()} inlineplugin'

    def get_wrapper_tag(self):
        return 'span'


def finalize_inline_yaml(p_yaml: Optional[str]):
    if not p_yaml:
        return ''
    if '\n' not in p_yaml:
        return f'{{{p_yaml}}}'
    return p_yaml
