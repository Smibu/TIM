# -*- coding: utf-8 -*-
"""Functions for dealing with plugin paragraphs."""
import json
from collections import OrderedDict, defaultdict
from itertools import chain
from typing import List, Tuple, Optional, Dict, Union, DefaultDict
from xml.sax.saxutils import quoteattr

import attr
import yaml
import yaml.parser
from sqlalchemy import func

from timApp.answer.answer import Answer
from timApp.auth.accesshelper import has_edit_access, verify_view_access
from timApp.auth.sessioninfo import get_current_user_object
from timApp.document.docentry import DocEntry
from timApp.document.docparagraph import DocParagraph
from timApp.document.docsettings import DocSettings
from timApp.document.document import dereference_pars, Document
from timApp.document.macroinfo import MacroInfo
from timApp.document.yamlblock import YamlBlock
from timApp.markdown.dumboclient import call_dumbo
from timApp.markdown.htmlSanitize import sanitize_html
from timApp.plugin.containerLink import plugin_reqs, get_plugin
from timApp.plugin.containerLink import render_plugin_multi, render_plugin, get_plugins
from timApp.plugin.plugin import Plugin, PluginRenderOptions, load_markup_from_yaml, expand_macros_for_plugin, \
    find_inline_plugins, InlinePlugin, finalize_inline_yaml
from timApp.plugin.pluginOutputFormat import PluginOutputFormat
from timApp.plugin.pluginexception import PluginException
from timApp.plugin.taskid import TaskId
from timApp.printing.printsettings import PrintFormat
from timApp.user.user import User
from timApp.util.rndutils import get_simple_hash_from_par_and_user
from timApp.util.timtiming import taketime
from timApp.util.utils import get_error_html, get_error_tex, Range


def get_error_plugin(plugin_name, message, response=None,
                     plugin_output_format: PluginOutputFormat = PluginOutputFormat.HTML):
    """

    :param response:
    :type message: str
    :type plugin_name: str
    """
    if plugin_output_format == PluginOutputFormat.MD:
        return get_error_tex(f'Plugin {plugin_name} error:', message, response)

    return get_error_html(f'Plugin {plugin_name} error: {message}', response)


def task_ids_to_strlist(ids: List[TaskId]):
    return [t.doc_task for t in ids]


def find_task_ids(
        blocks: List[DocParagraph],
        check_access=True,
) -> Tuple[List[TaskId], int, List[TaskId]]:
    """Finds all task plugins from the given list of paragraphs and returns their ids."""
    task_ids = []
    plugin_count = 0
    access_missing = []
    curr_user = get_current_user_object()

    def handle_taskid(t: TaskId):
        if not t.doc_id:
            t.update_doc_id_from_block(block)
        elif check_access:
            b = DocEntry.find_by_id(t.doc_id)
            if b and not curr_user.has_seeanswers_access(b):
                access_missing.append(t)
                return True

    for block in blocks:
        task_id = block.get_attr('taskId')
        plugin = block.get_attr('plugin')
        if plugin:
            plugin_count += 1
            if task_id:
                try:
                    tid = TaskId.parse(task_id, require_doc_id=False, allow_block_hint=False)
                except PluginException:
                    continue
                if handle_taskid(tid):
                    continue
                task_ids.append(tid)
        elif block.get_attr('defaultplugin'):
            for task_id, _, _, _, _ in find_inline_plugins(block, block.doc.get_settings().get_macroinfo()):
                try:
                    task_id.validate()
                except PluginException:
                    continue
                plugin_count += 1
                if handle_taskid(task_id):
                    continue
                task_ids.append(task_id)
    return task_ids, plugin_count, access_missing


PluginOrError = Union[Plugin, str]  # str represent HTML markup of error
AnswerMap = Dict[str, Tuple[Answer, int]]
ErrorMap = Dict[Range, Tuple[str, str]]


@attr.s
class PluginPlacement:
    """Represents the position(s) of plugin(s) in a block.

    Can be either:
     * a block-level (traditional) plugin, or
     * one or more inlineplugins.

    In case of a block-level plugin, the range spans the entire block's expanded markdown.
    """
    plugins: Dict[Range, Plugin] = attr.ib(kw_only=True)  # ordered

    errors: ErrorMap = attr.ib(kw_only=True)  # ordered
    block: DocParagraph = attr.ib(kw_only=True)
    """The block where the plugins are."""

    expanded_md: str = attr.ib(kw_only=True)
    """Expanded markdown of the containing block."""

    is_block_plugin: bool = attr.ib(kw_only=True)
    """Whether this is a block-level plugin."""

    output_format: PluginOutputFormat = attr.ib(kw_only=True)

    def get_block_plugin(self):
        if not self.is_block_plugin:
            return None
        try:
            return next(iter(self.plugins.values()))
        except StopIteration:
            return None

    def set_error(self, r: Range, err: str):
        p = self.plugins.pop(r)
        self.errors[r] = err, p.type

    def set_output(self, r: Range, out: str):
        self.plugins[r].set_output(out)

    def get_block_output(self):
        sorted_ranges = sorted(chain(self.plugins.keys(), self.errors.keys()), key=lambda r: r[0], reverse=True)
        out_md = self.expanded_md
        for sr in sorted_ranges:
            p = self.plugins.get(sr)
            if not p:
                err, name = self.errors[sr]
                h = get_error_plugin(name, err, plugin_output_format=self.output_format)
            else:
                h = p.get_final_output()
            start, end = sr
            out_md = out_md[:start] + h + out_md[end:]
        return out_md

    @staticmethod
    def from_par(
            block: DocParagraph,
            load_states: bool,
            macroinfo: MacroInfo,
            plugin_opts: PluginRenderOptions,
            user: User,
            settings: DocSettings,
            answer_map: AnswerMap,
            custom_answer: Optional[Answer],
            output_format: PluginOutputFormat,
    ) -> Optional['PluginPlacement']:
        plugin_name = block.get_attr('plugin')
        defaultplugin = block.get_attr('defaultplugin')
        if not plugin_name and not defaultplugin:
            return None
        new_seed = False
        rnd_seed = None
        answer_and_cnt = None

        if rnd_seed is None:
            rnd_seed = get_simple_hash_from_par_and_user(
                block,
                user,
            )  # TODO: RND_SEED: get users seed for this plugin
            new_seed = True

        rnd_error = None
        try:
            if block.insert_rnds(rnd_seed) and new_seed:  # do not change order!  inserts must be done
                # TODO: RND_SEED save rnd_seed to user data
                pass
        except ValueError as e:
            rnd_error = str(e)

        errs = OrderedDict()
        plugs = OrderedDict()
        is_block_plugin = bool(plugin_name)
        if rnd_error:
            md = block.get_expanded_markdown(macroinfo)
            errs[0, len(md)] = rnd_error, plugin_name or defaultplugin
        elif plugin_name:
            # We want the expanded markdown here, so can't call Plugin.from_paragraph[_macros] directly.
            macros = macroinfo.get_macros()
            macro_delimiter = macroinfo.get_macro_delimiter()
            md = expand_macros_for_plugin(block, macros, macro_delimiter)
            p_range = 0, len(md)
            try:
                vals = load_markup_from_yaml(md, settings.global_plugin_attrs(), block.get_attr('plugin'))
            except PluginException as e:
                errs[p_range] = str(e), plugin_name
            else:
                taskid = block.get_attr('taskId')
                try:
                    tid = TaskId.parse(taskid, require_doc_id=False, allow_block_hint=False) if taskid else None
                except PluginException as e:
                    errs[p_range] = str(e), plugin_name
                else:
                    if check_task_access(errs, p_range, plugin_name, tid):
                        plugs[p_range] = Plugin(
                            tid,
                            vals,
                            plugin_name,
                            par=block,
                        )
        else:
            md = None
            for task_id, p_yaml, p_range, plugin_type, md in find_inline_plugins(block, macroinfo):
                plugin_type = plugin_type or defaultplugin
                if not check_task_access(errs, p_range, plugin_type, task_id):
                    continue
                try:
                    task_id.validate()
                    y = load_markup_from_yaml(finalize_inline_yaml(p_yaml), settings.global_plugin_attrs(), plugin_type)
                except PluginException as e:
                    errs[p_range] = str(e), plugin_type
                    continue
                plug = InlinePlugin(
                    task_id=task_id,
                    values=y,
                    plugin_type=plugin_type,
                    p_range=p_range,
                    par=block,
                )
                plugs[p_range] = plug
        if not md:
            # Can happen if inline plugin block has no plugins.
            md = block.get_expanded_markdown(macroinfo)
        for p in plugs.values():
            if p.type == 'qst':
                p.values['isTask'] = not block.is_question()

            if load_states:
                if custom_answer is not None:
                    answer_and_cnt = custom_answer, custom_answer.get_answer_number()
                elif p.task_id:
                    answer_and_cnt = answer_map.get(p.task_id.doc_task, None)

            p.set_render_options(answer_and_cnt if load_states and answer_and_cnt is not None else None,
                                 plugin_opts)
        return PluginPlacement(
            block=block,
            errors=errs,
            expanded_md=md,
            plugins=plugs,
            is_block_plugin=is_block_plugin,
            output_format=output_format,
        )


def check_task_access(errs: ErrorMap, p_range: Range, plugin_name: str, tid: TaskId):
    if tid and tid.doc_id:
        b = DocEntry.find_by_id(tid.doc_id)
        if b:
            has_access = verify_view_access(b, require=False)
            if not has_access:
                errs[p_range] = ('Task id refers to another document, '
                                 'but you do not have access to that document.'), plugin_name
                return False
        else:
            errs[p_range] = 'Task id refers to a non-existent document.', plugin_name
            return False
    return True


KeyType = Tuple[int, Range]


def pluginify(doc: Document,
              pars: List[DocParagraph],
              user: Optional[User],
              custom_answer: Optional[Answer] = None,
              sanitize=True,
              do_lazy=False,
              edit_window=False,
              load_states=True,
              review=False,
              wrap_in_div=True,
              output_format: PluginOutputFormat = PluginOutputFormat.HTML,
              user_print: bool = False,
              target_format: PrintFormat = PrintFormat.LATEX,
              dereference=True) -> Tuple[List[DocParagraph], List[str], List[str]]:
    """
    "Pluginifies" the specified DocParagraphs by calling the corresponding plugin route for each plugin
    paragraph.

    :param doc Document / DocumentVersion object.
    :param pars: A list of DocParagraphs to be processed.
    :param user: The current user object.
    :param custom_answer: Optional answer that will used as the state for the plugin instead of answer database.
    If this parameter is specified, the expression len(blocks) MUST be 1.
    :param sanitize: Whether the blocks should be sanitized before processing.
    :param do_lazy Whether to use lazy versions of the plugins.
    :param edit_window Whether the method is called from the edit window or not.
    :param output_format: Desired output format (html/md) for plugins
    :param user_print: Whether the plugins should output the original values or user's input (when exporting markdown).
    :param target_format: for MD-print what exact format to use
    :param dereference: should pars be checked id dereference is needed
    :return: Processed HTML blocks along with JavaScript and CSS stylesheet dependencies.
    """

    taketime("answ", "start")
    if dereference:
        pars = dereference_pars(pars, context_doc=doc)
    if not edit_window and has_edit_access(doc.get_docinfo()):
        for p in pars:
            if p.is_translation_out_of_date():
                p.add_class('tr-outofdate')
    if sanitize:
        for par in pars:
            par.sanitize_html()

    # init these for performance as they stay the same for all pars
    md_out = (output_format == PluginOutputFormat.MD)
    html_out = False if md_out else (output_format == PluginOutputFormat.HTML)

    html_pars = [par.get_final_dict(use_md=md_out) for par in pars]

    if custom_answer is not None:
        if len(pars) != 1:
            raise PluginException('len(blocks) must be 1 if custom state is specified')
    plugins: DefaultDict[str, Dict[KeyType, Plugin]] = defaultdict(OrderedDict)

    answer_map: AnswerMap = {}
    plugin_opts = PluginRenderOptions(do_lazy=do_lazy,
                                      user_print=user_print,
                                      preview=edit_window,
                                      target_format=target_format,
                                      output_format=output_format,
                                      user=user,
                                      review=review,
                                      wrap_in_div=wrap_in_div
                                      )

    if load_states and custom_answer is None and user is not None:
        task_ids, _, _ = find_task_ids(pars, check_access=user != get_current_user_object())
        col = func.max(Answer.id).label('col')
        cnt = func.count(Answer.id).label('cnt')
        sub = (user
               .answers
               .filter(Answer.task_id.in_(task_ids_to_strlist(task_ids)) & Answer.valid == True)
               .add_columns(col, cnt)
               .with_entities(col, cnt)
               .group_by(Answer.task_id).subquery())
        answers: List[Tuple[Answer, int]] = (
            Answer.query.join(sub, Answer.id == sub.c.col)
                .with_entities(Answer, sub.c.cnt)
                .all()
        )
        # TODO: RND_SEED get all users rand_seeds for this doc's tasks. New table?
        for answer, cnt in answers:
            answer_map[answer.task_id] = answer, cnt

    placements = {}
    dumbo_opts = OrderedDict()
    for idx, block in enumerate(pars):
        is_gamified = block.get_attr('gamification')
        is_gamified = not not is_gamified
        settings = block.doc.get_settings()
        macroinfo = settings.get_macroinfo(user=user)

        if is_gamified:
            md = block.get_expanded_markdown(macroinfo=macroinfo)
            try:
                gd = YamlBlock.from_markdown(md).values
                runner = 'gamification-map'
                html_pars[idx][output_format.value] = f'<{runner} data={quoteattr(json.dumps(gd))}></{runner}>'
            except yaml.YAMLError as e:
                html_pars[idx][output_format.value] = '<div class="error"><p>Gamification error:</p><pre>' + \
                                                      str(e) + \
                                                      '</pre><p>From block:</p><pre>' + \
                                                      md + \
                                                      '</pre></div>'

        pplace = PluginPlacement.from_par(
            block=block,
            plugin_opts=plugin_opts,
            answer_map=answer_map,
            load_states=load_states,
            macroinfo=macroinfo,
            settings=settings,
            user=user,
            custom_answer=custom_answer,
            output_format=output_format,
        )
        if pplace:
            placements[idx] = pplace
            for r, p in pplace.plugins.items():
                plugins[p.type][idx, r] = p
            if not pplace.is_block_plugin:
                dumbo_opts[idx] = block.get_dumbo_options(base_opts=settings.get_dumbo_options())
        else:
            if block.nocache and not is_gamified:  # get_nocache():
                # if block.get_nocache():
                texts = [block.get_expanded_markdown(macroinfo)]
                htmls = call_dumbo(texts, options=block.get_dumbo_options(base_opts=settings.get_dumbo_options()))
                html_pars[idx][output_format.value] = htmls[0]  # to collect all together before dumbo

                # taketime("answ", "markup", len(plugins))

    js_paths = []
    css_paths = []

    # taketime("answ", "done", len(answers))

    for plugin_name, plugin_block_map in plugins.items():
        taketime("plg", plugin_name)
        try:
            plugin = get_plugin(plugin_name)
            plugin_lazy = plugin.get("lazy", True)
            plugin["canGiveTask"] = False
            resp = plugin_reqs(plugin_name)
        except PluginException as e:
            for idx, r in plugin_block_map.keys():
                placements[idx].set_error(r, str(e))
            continue
        # taketime("plg e", plugin_name)
        try:
            reqs = json.loads(resp)
            plugin["canGiveTask"] = reqs.get("canGiveTask", False)
            if plugin_name == 'mmcq' or plugin_name == 'mcq':
                reqs['multihtml'] = True
                reqs['multimd'] = True
        except ValueError as e:
            for idx, r in plugin_block_map.keys():
                placements[idx].set_error(r, f'Failed to parse JSON from plugin reqs route: {e}')
            continue
        plugin_js_files, plugin_css_files = plugin_deps(reqs)
        for src in plugin_js_files:
            if src.startswith("http") or src.startswith("/"):  # absolute URL
                js_paths.append(src)
            elif src.endswith('.js'):  # relative JS URL
                js_paths.append(f"/{plugin_name}/{src}")
            else:  # module name
                js_paths.append(src)
        for src in plugin_css_files:
            if src.startswith("http") or src.startswith("/"):
                css_paths.append(src)
            else:
                css_paths.append(f"/{plugin_name}/{src}")

        # Remove duplicates, preserving order
        js_paths = list(OrderedDict.fromkeys(js_paths))
        css_paths = list(OrderedDict.fromkeys(css_paths))

        default_auto_md = reqs.get('default_automd', False)

        if (html_out and reqs.get('multihtml')) or (md_out and reqs.get('multimd')):
            try:
                # taketime("plg m", plugin_name)
                response = render_plugin_multi(
                    doc,
                    plugin_name,
                    list(plugin_block_map.values()),
                    plugin_output_format=output_format,
                    default_auto_md=default_auto_md)
                # taketime("plg e", plugin_name)
            except PluginException as e:
                for idx, r in plugin_block_map.keys():
                    placements[idx].set_error(r, str(e))
                continue
            try:
                plugin_htmls = json.loads(response)
            except ValueError as e:
                for idx, r in plugin_block_map.keys():
                    placements[idx].set_error(r, f'Failed to parse plugin response from multihtml route: {e}')
                continue
            if not isinstance(plugin_htmls, list):
                for ((idx, r), plugin) in plugin_block_map.items():
                    plugin.plugin_lazy = plugin_lazy
                    placements[idx].set_error(r, f'Multihtml response of {plugin_name} was not a list: {plugin_htmls}')
            else:
                for ((idx, r), plugin), html in zip(plugin_block_map.items(), plugin_htmls):
                    plugin.plugin_lazy = plugin_lazy
                    placements[idx].set_output(r, html)
        else:
            for (idx, r), plugin in plugin_block_map.items():
                if md_out:
                    err_msg_md = "Plugin does not support printing yet. " \
                                 "Please refer to TIM help pages if you want to learn how you can manually " \
                                 "define what to print here."
                    placements[idx].set_error(r, err_msg_md)
                else:
                    try:
                        html = render_plugin(doc=doc,
                                             plugin=plugin,
                                             output_format=output_format)
                    except PluginException as e:
                        placements[idx].set_error(r, str(e))
                        continue
                    placements[idx].set_output(r, html)
    for idx, place in placements.items():
        par = html_pars[idx]
        par[output_format.value] = place.get_block_output()
        bp = place.get_block_plugin()
        if bp:
            par['answerbrowser_type'] = bp.get_answerbrowser_type()
            par['answer_count'] = bp.answer_count
            if bp.task_id:
                attrs = par.get('ref_attrs', par['attrs'])
                attrs['taskIdObj'] = bp.task_id

    # inline plugin blocks need to go through Dumbo to process MD
    if output_format == PluginOutputFormat.HTML:
        htmls_to_dumbo = []
        settings_to_dumbo = []
        for k, v in dumbo_opts.items():
            # Need to wrap in div because otherwise dumbo might generate invalid HTML
            htmls_to_dumbo.append({'content': '<div>' + html_pars[k][output_format.value] + '</div>', **v.dict()})
            settings_to_dumbo.append(v)
        for h, (idx, s) in zip(call_dumbo(htmls_to_dumbo,
                                          options=doc.get_settings().get_dumbo_options()),
                               dumbo_opts.items()):
            html_pars[idx][output_format.value] = sanitize_html(h)
    # taketime("phtml done")

    return pars, js_paths, css_paths


def get_all_reqs():
    allreqs = {}
    for plugin, vals in get_plugins().items():
        if vals.get('skip_reqs', False):
            continue
        try:
            resp = plugin_reqs(plugin)
        except PluginException:
            continue
        try:
            reqs = json.loads(resp)
            allreqs[plugin] = reqs
        except ValueError:
            continue
    return allreqs


def plugin_deps(p: Dict) -> Tuple[List[str], List[str]]:
    """

    :param p: is json of plugin requirements of the form:
              {"js": ["js.js"], "css":["css.css"]}
    """
    js_files = []
    css_files = []
    if "css" in p:
        for cssF in p['css']:
            css_files.append(cssF)
    if "js" in p:
        for jsF in p['js']:
            js_files.append(jsF)
    return js_files, css_files
