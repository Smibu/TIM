"""
Functions for calling pandoc and constructing the calls
"""
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, List, Tuple, Dict

from flask import current_app
from jinja2.sandbox import SandboxedEnvironment
from pypandoc import _as_unicode, _validate_formats
from pypandoc.py3compat import string_types, cast_bytes

from timApp.auth.accesshelper import has_view_access
from timApp.auth.sessioninfo import get_current_user_object
from timApp.document.docentry import DocEntry
from timApp.document.docinfo import DocInfo
from timApp.document.docparagraph import DocParagraph, add_heading_numbers
from timApp.document.docsettings import DocSettings
from timApp.document.document import dereference_pars, Document
from timApp.document.macroinfo import MacroInfo
from timApp.document.preloadoption import PreloadOption
from timApp.document.randutils import hashfunc
from timApp.document.specialnames import TEMPLATE_FOLDER_NAME, PRINT_FOLDER_NAME
from timApp.document.usercontext import UserContext
from timApp.document.viewcontext import default_view_ctx
from timApp.document.yamlblock import strip_code_block
from timApp.folder.folder import Folder
from timApp.markdown.htmlSanitize import sanitize_html
from timApp.markdown.markdownconverter import expand_macros, create_environment
from timApp.plugin.plugin import get_value, PluginWrap
from timApp.plugin.plugin import parse_plugin_values_macros
from timApp.plugin.pluginControl import pluginify
from timApp.plugin.pluginOutputFormat import PluginOutputFormat
from timApp.plugin.pluginexception import PluginException
from timApp.printing.printeddoc import PrintedDoc
from timApp.printing.printsettings import PrintFormat
from timApp.timdb.dbaccess import get_files_path
from timApp.user.user import User
from timApp.util.utils import cache_folder_path

DEFAULT_PRINTING_FOLDER = cache_folder_path / 'printed_documents'
TEMPLATES_FOLDER = Path(TEMPLATE_FOLDER_NAME) / PRINT_FOLDER_NAME
TEX_MACROS_KEY = "texmacros"

REGSLIDESEP = re.compile("^-{3,}$")  # slide separator

class PrintingError(Exception):
    pass


class LaTeXError(Exception):
    def __init__(self, value):
        self.value = value

    def __str__(self):
        return repr(self.value)


def add_nonumber(md: str) -> str:
    """
    Adds {.unnumbered} after every heading line that starts with #
        Special cases:
            - many # lines in same md
                - before #-line there must be at least two cr
                - split between two cr
            - line starting with # may continue by ordinary line
                - the unnumbered must be added before first cr
            - line starting with # may continue next line and have \ at the end
                 - undefined
    :param md: markdown to be converted
    :return: markdown with headings marked as unnumbered
    """
    mds = md.split("\n\n")
    result = ""
    for m in mds:
        if m.startswith("#"):
            ms = m.split("\n")
            if not ms[0].endswith("\\"):
                ms[0] += "{.unnumbered}"
            m = "\n".join(ms)
        result += m + "\n\n"

    return result


def get_tex_settings_and_macros(d: Document, user_ctx: UserContext):
    settings = d.get_settings()
    pdoc_plugin_attrs = settings.global_plugin_attrs()
    pdoc_macroinfo = settings.get_macroinfo(default_view_ctx, user_ctx)
    pdoc_macro_delimiter = pdoc_macroinfo.get_macro_delimiter()
    pdoc_macros = pdoc_macroinfo.get_macros()
    pdoc_macro_env = create_environment(
        pdoc_macro_delimiter,
        user_ctx.user,
        default_view_ctx,
    )
    pdoc_macros.update(settings.get_texmacroinfo(default_view_ctx).get_macros())
    return settings, pdoc_plugin_attrs, pdoc_macro_env, pdoc_macros, pdoc_macro_delimiter


class DocumentPrinter:
    def __init__(self, doc_entry: DocEntry, template_to_use: Optional[DocInfo], urlroot: str):
        self._doc_entry = doc_entry
        self._template_to_use = template_to_use
        self._content = None
        self._print_hash = None
        self._macros = {}
        self.texplain = False
        self.textplain = False
        self.texfiles = None
        self.urlroot = urlroot

    def get_template_id(self) -> Optional[int]:
        if self._template_to_use:
            return self._template_to_use.id
        return None

    def get_content(self, user_ctx: UserContext, plugins_user_print: bool = False, target_format: PrintFormat = PrintFormat.PLAIN) -> str:
        """
        Gets the content of the DocEntry assigned for this DocumentPrinter object.
        Fetches the markdown for the documents paragraphs, checks whether the
        paragraph should be printed (determined by a boolean 'print'-attribute,
        and returns the markdown for all the paragraphs that should be printed.

        Returns the (markdown) contents of the file as a single string, as that's the
        format pypandoc likes to handle.

        :return: The TIM documents contents in markdown format. Excludes the paragraphs that have attribute
                 print="false"
        """

        if self._content is not None:
            return self._content

        settings, _, _, pdoc_macros, _ = get_tex_settings_and_macros(self._doc_entry.document, user_ctx)

        self._macros = pdoc_macros

        # Remove paragraphs that are not to be printed and replace plugin pars,
        # that have a defined 'texprint' block in their yaml, with the 'texprint'-blocks content
        pars = self._doc_entry.document.get_paragraphs(include_preamble=True)
        self._doc_entry.document.preload_option = PreloadOption.all
        pars = dereference_pars(pars, context_doc=self._doc_entry.document, view_ctx=default_view_ctx)
        pars_to_print = []
        self.texplain = settings.is_texplain()
        self.textplain = settings.is_textplain()

        self.texfiles = settings.get_texmacroinfo(default_view_ctx). \
            get_macros().get('texfiles')
        if self.texfiles and self.texfiles is str:
            self.texfiles = [self.texfiles]

        par_infos: List[Tuple[DocParagraph, DocSettings, dict, SandboxedEnvironment, Dict[str, object], str]] = []
        for par in pars:

            # do not print document settings pars
            if par.is_setting():
                continue

            p_info = par, *get_tex_settings_and_macros(par.doc, user_ctx)
            _, _, pdoc_plugin_attrs, env, pdoc_macros, pdoc_macro_delimiter = p_info

            if self.texplain or self.textplain:
                if par.get_markdown().find("#") == 0:
                    continue

            if par.has_class('hidden-print'):
                continue

            ppar = par
            # Replace plugin- and question pars with regular docpars with the md defined in the 'print' block
            # of their yaml as the md content of the replacement par
            if par.is_plugin():
                try:
                    plugin_yaml = parse_plugin_values_macros(par=par,
                                                             global_attrs=pdoc_plugin_attrs,
                                                             macros=pdoc_macros,
                                                             env=env)
                except PluginException:
                    plugin_yaml = {}
                plugin_yaml_beforeprint = get_value(plugin_yaml, 'texbeforeprint')
                if plugin_yaml_beforeprint is not None:
                    bppar = DocParagraph.create(doc=self._doc_entry.document, md=plugin_yaml_beforeprint)
                    par_infos.append(p_info)
                    pars_to_print.append(bppar)

                plugin_yaml_print = get_value(plugin_yaml, 'texprint')
                if plugin_yaml_print is not None:
                    ppar = DocParagraph.create(doc=self._doc_entry.document, md=plugin_yaml_print)
                par_infos.append(p_info)
                pars_to_print.append(ppar)

                plugin_yaml_afterprint = get_value(plugin_yaml, 'texafterprint')
                if plugin_yaml_afterprint is not None:
                    appar = DocParagraph.create(doc=self._doc_entry.document, md=plugin_yaml_afterprint)
                    par_infos.append(p_info)
                    pars_to_print.append(appar)

            else:
                par_infos.append(p_info)
                pars_to_print.append(ppar)

        tformat = target_format
        if target_format in (PrintFormat.PDF, PrintFormat.JSON):
            tformat = PrintFormat.LATEX

        # render markdown for plugins
        presult = pluginify(doc=self._doc_entry.document, pars=pars_to_print, user_ctx=user_ctx, view_ctx=default_view_ctx,
                            pluginwrap=PluginWrap.Nothing, output_format=PluginOutputFormat.MD,
                            user_print=plugins_user_print, target_format=tformat, dereference=False)
        pars_to_print = presult.pars

        export_pars = []

        # Get the markdown for each par dict
        for p, (_, settings, pdoc_plugin_attrs, pdoc_macro_env, pdoc_macros, pdoc_macro_delimiter) in zip(pars_to_print,
                                                                                                          par_infos):
            md = p.get_final_dict(default_view_ctx)['md']
            if not p.is_plugin() and not p.is_question():
                if not self.texplain and not self.textplain:
                    md = expand_macros(
                        text=md,
                        macros=pdoc_macros,
                        settings=settings,
                        env=pdoc_macro_env,
                        ignore_errors=False,
                    )
                classes = p.get_classes()
                if classes:
                    endraw = ""
                    beginraw = ""
                    nonumber = ""
                    for cls in classes:
                        if cls == 'visible-print':
                            continue
                        if cls == "nonumber":
                            nonumber = "{.unnumbered}"
                        else:
                            if target_format == "html":
                                beginraw += '<div class="' + cls + '">'
                                endraw += "</div>"
                            elif target_format == "plain":
                                beginraw = ''
                            else:
                                beginraw += "RAWTEX" + cls + "\n\n"
                                endraw += "\n\nENDRAWTEX"
                    if nonumber:
                        md = add_nonumber(md)
                    md = beginraw + md + endraw

                if self.texplain or self.textplain:
                    if md.startswith('```'):
                        md = md[3:-3]
                if not pdoc_macros.get('texautonumber') and settings.auto_number_headings():
                    md = add_heading_numbers(md, p, settings.heading_format())

                '''
                if pd['md'].startswith('#'):
                    pd['md'] += ' {{ {} }}'.format(
                        ' '.join(['.{}'.format(class_name) for class_name in pd['attrs'].get('classes', [])]))
                pd['md'] = expand_macros(text=pd['md'],
                                         macros=pdoc_macros,
                                         macro_delimiter=pdoc_macro_delimiter,
                                         env=pdoc_macro_env,
                                         ignore_errors=True)
                '''
            if md.find("§") >= 0:  # check if slide fragments
                md = md.replace("<§", "").replace("§>", "").replace("§§", "")
            if md.find("---") >= 0: # check if slide separator
                if REGSLIDESEP.match(md):
                    continue
            export_pars.append(md)

        if self.texplain or self.textplain:
            content = '\n'.join(export_pars)
        else:
            content = settings.get_doctexmacros() + '\n' + '\n\n'.join(export_pars)

        self._content = content
        return content

    def write_to_format(self, user_ctx: UserContext, target_format: PrintFormat, path: Path, plugins_user_print: bool = False):
        """
        Converts the document to latex and returns the converted document as a bytearray
        :param user_ctx: The user context.
        :param target_format: The target file format
        :param plugins_user_print: Whether or not to print user input from plugins (instead of default values)
        :param path:  filepath to write
        :return: Converted document as bytearray
        """

        with tempfile.NamedTemporaryFile(suffix='.latex', delete=True) as template_file:

            if self._template_to_use:
                template_content = DocumentPrinter.parse_template_content(doc_to_print=self._doc_entry,
                                                                          template_doc=self._template_to_use)
            else:
                template_content = '$body$\n'

            if template_content is None:
                raise PrintingError(
                    f"The content in the template document {self._template_to_use.path} is not valid.")

            top_level = 'section'
            if re.search("^\\\\documentclass\[[^\n]*(book|report)\}", template_content, flags=re.S):
                top_level = 'chapter'

            src = self.get_content(user_ctx, plugins_user_print=plugins_user_print, target_format=target_format)

            templbyte = bytearray(template_content, encoding='utf-8')
            # template_file.write(templbyte) # for some reason does not write small files
            with open(template_file.name, 'wb') as f:
                f.write(templbyte)

            print_dir = os.path.dirname(os.path.realpath(__file__))
            filters = [
                os.path.join(print_dir, "pandoc_inlinestylesfilter.py"),
                os.path.join(print_dir, "pandoc_imagefilepathsfilter.py"),
                # os.path.join(print_dir, "pandoc_headernumberingfilter.py")  # handled already when making md
            ]

            ftop = self._macros.get('texforcetoplevel', None)
            if ftop:
                top_level = ftop

            os.environ["texdocid"] = str(self._doc_entry.document.doc_id)
            from_format = 'markdown'
            if self.texplain:
                from_format = 'latex'
            if self.textplain:
                from_format = 'latex'

            texfiles = None
            if self.texfiles:
                texfiles = []
                for texfile in self.texfiles:
                    if texfile.startswith('http'):
                        texfiles.append(texfile)
                    else:
                        if texfile.find('/') < 0:  # add path if missing
                            texfile = self._doc_entry.document.docinfo.location + '/' + texfile
                        texfiles.append(self.urlroot + texfile + '?file_type=latex&template_doc_id=0')

            # TODO: add also variables from texpandocvariables document setting, but this may lead to security hole?
            try:
                tim_convert_text(
                    source=src,
                    from_format=from_format,
                    to=target_format.value,
                    outputfile=path.absolute().as_posix(),  # output_file.name,
                    extra_args=['--template=' + template_file.name,
                                '--variable=TTrue:1',
                                '--variable=T1:1',
                                '--top-level-division=' + top_level,
                                '--atx-headers',
                                '--metadata=pagetitle:""',
                                # '--verbose',  # this gives non UTF8 results sometimes
                                '-Mtexdocid=' + str(self._doc_entry.document.doc_id),
                                ],
                    filters=filters,
                    texfiles=texfiles,
                )
            except LaTeXError as ex:
                raise LaTeXError(ex.value)
            except Exception as ex:
                raise PrintingError(f'<pre>{sanitize_html(str(ex))}</pre>')

    def get_print_path(self, file_type: PrintFormat, plugins_user_print: bool = False) -> Path:
        """
        Formulates the printing path for the given document

        :param file_type: File format for the output
        :param plugins_user_print: should print user answers
        :return:
        """

        print_hash = self.hash_doc_print(plugins_user_print=plugins_user_print)

        path = (DEFAULT_PRINTING_FOLDER /
                str(self._doc_entry.id) /
                str(self.get_template_id()) /
                str(print_hash + "." + file_type.value))

        return path

    @staticmethod
    def get_user_templates(doc_entry: DocEntry, current_user: User) -> List[DocEntry]:
        templates = []

        if doc_entry is None or current_user is None:
            raise PrintingError("You need to supply both the DocEntry and User to fetch the printing templates.")

        path = os.path.join(current_user.get_personal_folder().get_full_path(), TEMPLATES_FOLDER)

        templates_folder = Folder.find_by_path(path)

        if templates_folder is not None and has_view_access(templates_folder):
            docs = templates_folder.get_all_documents()
            if docs is not None:
                for d in docs:
                    if has_view_access(d) and not re.search(f"/{PRINT_FOLDER_NAME}/.*{TEMPLATE_FOLDER_NAME}/", d.name):
                        templates.append(d)

        return templates

    @staticmethod
    def get_all_templates(doc_entry: DocEntry, current_user: User) -> List[DocEntry]:
        templates = []

        if doc_entry is None or current_user is None:
            raise PrintingError("You need to supply both the DocEntry and User to fetch the printing templates.")

        current_folder = doc_entry.parent
        while current_folder is not None:

            path = os.path.join(current_folder.get_full_path(),
                                TEMPLATES_FOLDER)

            templates_folder = Folder.find_by_path(path)

            if templates_folder is not None and has_view_access(templates_folder):
                docs = templates_folder.get_all_documents()

                if docs is None:
                    continue

                for d in docs:
                    if has_view_access(d) and not re.search(f"/{PRINT_FOLDER_NAME}/.*{TEMPLATE_FOLDER_NAME}/", d.name):
                        templates.append(d)

            current_folder = current_folder.parent

        return templates

    @staticmethod
    def get_templates_as_dict(doc_entry: DocEntry, current_user: User):
        settings = doc_entry.document.get_settings()
        tex_template = settings.get("texTemplate", "")
        try:
            user_templates = DocumentPrinter.get_user_templates(doc_entry=doc_entry, current_user=current_user)
            all_templates = DocumentPrinter.get_all_templates(doc_entry=doc_entry, current_user=current_user)
            if tex_template:
                all_templates.append(DocEntry.find_by_path(tex_template))
        except PrintingError as err:
            raise PrintingError(str(err))

        default_templates = list(set(all_templates) - set(user_templates))

        user_templates_list: List[DocInfo] = []
        for t in user_templates:
            user_templates_list.append(t)

        default_templates_list: List[DocInfo] = []
        for t in default_templates:
            default_templates_list.append(t)

        user_templates_list.sort(key=lambda x: x.title)
        default_templates_list.sort(key=lambda x: x.title)

        templates_list = user_templates_list + default_templates_list

        return templates_list

    @staticmethod
    def parse_template_content(template_doc: DocInfo, doc_to_print: DocEntry) -> str:
        pars = template_doc.document.get_paragraphs()

        pars = dereference_pars(pars, context_doc=template_doc.document, view_ctx=default_view_ctx)

        # attach macros from target document to template
        template_settings = template_doc.document.get_settings()
        doc_settings = doc_to_print.document.get_settings()

        macros = template_settings.get_macroinfo(default_view_ctx).get_macros()
        macros.update(template_settings.get_texmacroinfo(default_view_ctx).get_macros())
        macros.update(doc_settings.get_macroinfo(default_view_ctx).get_macros())
        macros.update(doc_settings.get_texmacroinfo(default_view_ctx).get_macros())

        out_pars = []
        macroinfo = MacroInfo(default_view_ctx, macro_map=macros)
        # go through doc pars to get all the template pars
        for par in pars:
            if par.get_attr('printing_template') is not None:
                exp_md = par.get_expanded_markdown(macroinfo=macroinfo, ignore_errors=True)
                out_pars.append(strip_code_block(exp_md.strip()))

        return "\n\n".join(out_pars)

    def get_document_version_as_float(self) -> float:
        doc_v = self._doc_entry.document.get_latest_version().get_version()
        doc_v_fst, doc_v_snd = doc_v[0], doc_v[1]
        return doc_v_fst + doc_v_snd / 10

    def get_template_version_as_float(self) -> Optional[float]:
        if self._template_to_use is None:
            return None

        doc_v = self._template_to_use.document.get_latest_version().get_version()
        doc_v_fst, doc_v_snd = doc_v[0], doc_v[1]
        return doc_v_fst + doc_v_snd / 10

    def hash_doc_print(self, plugins_user_print: bool = False) -> str:
        thash = ''
        if self._template_to_use:
            thash = self._template_to_use.last_modified
        content = str(self._doc_entry.id) + " " + str(self._doc_entry.last_modified) + \
                  str(self.get_template_id()) + " " + str(thash)
        if plugins_user_print:
            content += str(plugins_user_print) + str(get_current_user_object().id)

        return hashfunc(content)

    def get_printed_document_path_from_db(self, file_type: PrintFormat, plugins_user_print: bool = False) -> \
            Optional[str]:
        existing_print: Optional[PrintedDoc] = (
            PrintedDoc.query
                .filter_by(
                doc_id=self._doc_entry.id,
                template_doc_id=self.get_template_id(),
                file_type=file_type.value,
                version=self.hash_doc_print(plugins_user_print=plugins_user_print))
                .order_by(PrintedDoc.id.desc())
                .first()
        )
        if existing_print is None or not os.path.exists(existing_print.path_to_file):
            return None

        return existing_print.path_to_file


def number_lines(s: str, start: int = 1):
    lines = s.split("\n")
    i = start
    result = ""
    for line in lines:
        result += "{0:3}: {1}\n".format(i, line)
        i += 1
    return result


# ------------------------ copied from pypandoc / Juho Vepsäläinen ---------------------------------
# Use own version because the original breaks if there are non-ASCII chars in error messages

def tim_convert_text(source, to, from_format, extra_args=(), encoding='utf-8',
                     outputfile=None, filters=None, removethis=None, texfiles=None):
    """Converts given `source` from `format` to `to`.
    :param str source: Unicode string or bytes (see encoding)
    :param str to: format into which the input should be converted; can be one of
            `pypandoc.get_pandoc_formats()[1]`
    :param str from_format: the format of the inputs; can be one of `pypandoc.get_pandoc_formats()[1]`
    :param list extra_args: extra arguments (list of strings) to be passed to pandoc
            (Default value = ())
    :param str encoding: the encoding of the input bytes (Default value = 'utf-8')
    :param str outputfile: output will be written to outfilename or the converted content
            returned if None (Default value = None)
    :param list filters: pandoc filters e.g. filters=['pandoc-citeproc']
    :param removethis: lines that contains this text are removed from genereted LaTeX file
    :param texfiles: what files need to copy
    :returns: converted string (unicode) or an empty string if an outputfile was given
    :rtype: unicode

    :raises RuntimeError: if any of the inputs are not valid of if pandoc fails with an error
    :raises OSError: if pandoc is not found; make sure it has been installed and is available at
            path.
    """
    source = _as_unicode(source, encoding)
    return tim_convert_input(source, from_format, 'string', to, extra_args=extra_args,
                             outputfile=outputfile, filters=filters, removethis=removethis, texfiles=texfiles)


def tim_convert_input(source, from_format, input_type, to, extra_args=(), outputfile=None,
                      filters=None, removethis=None, texfiles=None):
    pandoc_path = '/usr/bin/pandoc'
    stdout = ''

    from_format, to = _validate_formats(from_format, to, outputfile)
    is_pdf = outputfile and outputfile.find('.pdf') >= 0
    latex_file = outputfile

    # To get access to pandoc-citeproc when we use a included copy of pandoc,
    # we need to add the pypandoc/files dir to the PATH
    new_env = os.environ.copy()
    files_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "files")
    new_env["PATH"] = new_env.get("PATH", "") + os.pathsep + files_path
    string_input = input_type == 'string'
    new_env['TIM_HOST'] = current_app.config['TIM_HOST']

    if is_pdf:
        latex_file = outputfile.replace('.pdf', '.latex')

    for texfile in texfiles or []:
        get_file(latex_file, texfile, new_env)

    if from_format == 'latex':
        with open(latex_file, "w", encoding='utf-8') as f:
            f.write(source)
    else:

        input_file = [source] if not string_input else []
        args = [pandoc_path, '--from=' + from_format, '--to=' + to]

        args += input_file

        if outputfile:
            args.append("--output=" + latex_file)

        args.extend(extra_args)

        # adds the proper filter syntax for each item in the filters list
        if filters is not None:
            if isinstance(filters, string_types):
                filters = filters.split()
            f = ['--filter=' + x for x in filters]
            args.extend(f)
        try:  # Hack because images in mmcqs is not found
            Path('/images').symlink_to(get_files_path() / 'blocks/images')
        except:
            pass
        p = subprocess.Popen(
            args,
            stdin=subprocess.PIPE if string_input else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=new_env)

        # something else than 'None' indicates that the process already terminated
        if not (p.returncode is None):
            raise RuntimeError(
                f'Pandoc died with exitcode "{p.returncode}" before receiving input: {p.stderr.read()}'
            )

        try:
            bsource = cast_bytes(source, encoding='utf-8')
        except (UnicodeDecodeError, UnicodeEncodeError):
            # assume that it is already a utf-8 encoded string
            bsource = source
        try:
            stdout, stderr = p.communicate(bsource if string_input else None)
        except OSError:
            # this is happening only on Py2.6 when pandoc dies before reading all
            # the input. We treat that the same as when we exit with an error...
            raise RuntimeError('Pandoc died with exitcode "%s" during conversion.' % p.returncode)

        stdout = _decode_result(stdout)
        stderr = _decode_result(stderr)
        if stdout or stderr:
            raise RuntimeError('Pandoc died with exitcode "%s" during conversion. \nSource=\n%s' %
                               (stdout + stderr, number_lines(source)))

        with open(latex_file, "r", encoding='utf-8') as r:
            lines = r.readlines()
        with open(latex_file, "w", encoding='utf-8') as f:
            for line in lines:
                if removethis:
                    if line.find(removethis) >= 0:
                        continue
                # line = line.replace(']{ ', ']{')  # correct "]{ %%" problem caused by Jinja 2 macros
                f.write(line)

    if is_pdf:
        p, stdout = run_latex(outputfile, latex_file, new_env, '')

    # if there is an outputfile, then stdout is likely empty!
    return stdout


def _decode_result(s):
    try:
        s = s.decode('utf-8')
    except UnicodeDecodeError:
        # this shouldn't happen: pandoc more or less garantees that the output is utf-8!
        # raise RuntimeError('Pandoc output was not utf-8.')
        # noinspection PyBroadException
        try:
            s = s.decode('iso-8859-15')
        except Exception:
            pass
    s = s.replace('\\n', '\n')
    return s


def run_latex(outputfile, latex_file, new_env, string_input):
    try:
        filedir = os.path.dirname(outputfile)
        args = ['latexmk', '-g', '-f', '-pdfxe', f'-output-directory={filedir}',  # '-file-line-error',
                '-interaction=nonstopmode', latex_file]
        p = subprocess.Popen(
            args,
            stdin=subprocess.PIPE if string_input else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=filedir,
            env=new_env)

        # something else than 'None' indicates that the process already terminated
        if not (p.returncode is None):
            raise RuntimeError(
                'LaTeX died with exitcode "%s" before receiving input: %s' % (p.returncode, p.stderr.read())
            )

        stdout, stderr = p.communicate(None)
        stdout = _decode_result(stdout)
        stderr = _decode_result(stderr)
        # check if latex returned successfully
        if p.returncode != 0:
            # Find errors:
            i = stdout.find('\n!')  # find possible error line from normal output
            # i = stdout.find('\n'+ latex_file + ':') # find possible error line in file:line:error format
            line = ''
            if i >= 0:
                stdout = stdout[i:]
                stdout = re.sub("\n\(/usr/.*[^\n]", "", stdout)
                stdout = stdout.replace(latex_file, '')
                i = stdout.find('/var/lib')
                if i >= 0:
                    stdout = stdout[:i - 3]
                i = stdout.find('\nl.')
                if i >= 0:
                    i2 = stdout.find(' ', i)
                    if i2 >= 0:
                        line = stdout[i + 3:i2]
            raise LaTeXError(
                {'line': line, 'latex': latex_file, 'pdf': outputfile, 'error': stdout}
                # 'LINE: %s\nLATEX:%s\nPDF:%s\nLaTeX died with exitcode "%s" during conversion: \n%s\n%s' %
                # (line, latex_file, outputfile, p.returncode, stdout, stderr)
            )
        return p, stdout
    except OSError as ex:
        # this is happening only on Py2.6 when pandoc dies before reading all
        # the input. We treat that the same as when we exit with an error...
        raise RuntimeError('LaTeX died with error "%s" during conversion.' % str(ex))


def get_file(latex_file, fileurl, new_env):
    filedir = os.path.dirname(latex_file)
    end = fileurl.find('?')
    if end < 0:
        end = len(fileurl)
    filename = fileurl[fileurl.rfind("/") + 1:end]
    dot = filename.rfind('.')  # change last - to . if there is no dot at the end
    minus = filename.rfind('-')
    if dot < minus:
        filename = filename[:minus] + '.' + filename[minus + 1:] # TODO: Remove this when all texfiles are changed and renamed
    args = ['wget', fileurl, '-O', filename]
    p = subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=filedir,
        env=new_env)

    code = p.returncode
    if code is not None:
        raise RuntimeError(
            f'Get file died with exitcode "{code}" before receiving input: {p.stderr.read()}'
        )

    stdout, stderr = p.communicate()
    stdout = _decode_result(stdout)
    stderr = _decode_result(stderr)
    if p.returncode > 0:
        raise RuntimeError(
            f'Get file {fileurl} failed: "{p.returncode}": {stdout} {stderr}'
        )
