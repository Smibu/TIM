from typing import Optional, List, Dict

import yaml

from timApp.documentmodel.docparagraph import DocParagraph
from timApp.documentmodel.macroinfo import MacroInfo
from timApp.documentmodel.yamlblock import YamlBlock
from timApp.timdb.timdbexception import TimDbException


class DocSettings:
    global_plugin_attrs_key = 'global_plugin_attrs'
    css_key = 'css'
    macros_key = 'macros'
    globalmacros_key = 'globalmacros'
    macro_delimiter_key = 'macro_delimiter'
    source_document_key = 'source_document'
    auto_number_headings_key = 'auto_number_headings'
    auto_number_start_key = 'auto_number_start'
    heading_format_key = 'heading_format'
    show_task_summary_key = 'show_task_summary'
    no_question_auto_numbering_key = 'no_question_auto_numbering'
    slide_background_url_key = 'slide_background_url'
    slide_background_color_key = 'slide_background_color'
    bookmark_key = 'bookmarks'
    lazy_key = 'lazy'
    hide_links_key = 'hide_links'
    point_sum_rule_key = 'point_sum_rule'
    max_points_key = 'max_points'
    live_updates_key = 'live_updates'
    plugin_md_key = 'plugin_md'
    print_settings_key = 'print_settings'

    @classmethod
    def is_valid_paragraph(cls, par):
        if par.is_reference() and not par.is_translation():
            par = par.get_referenced_pars(set_html=False)[0]
        if not par.is_setting():
            return True
        try:
            DocSettings.parse_values(par)
        except Exception as e:
            return False
        return True

    @classmethod
    def from_paragraph(cls, par):
        """Constructs DocSettings from the given DocParagraph.

        :param par: The DocParagraph to extract settings from.
        :type par: DocParagraph
        :return: The DocSettings object.

        """
        if par.is_reference() and not par.is_translation():
            try:
                par = par.get_referenced_pars(set_html=True, source_doc=par.doc)[0]
            except TimDbException as e:
                # Invalid reference, ignore for now
                return DocSettings(par.doc)
        if par.is_setting():
            try:
                yaml_vals = DocSettings.parse_values(par)
                return DocSettings(par.doc, settings_dict=yaml_vals)
            except Exception:
                return DocSettings(par.doc)
        else:
            return DocSettings(par.doc)

    @staticmethod
    def parse_values(par):
        return YamlBlock.from_markdown(par.get_markdown()).values

    def __init__(self, doc: 'Document', settings_dict: Optional[dict] = None):
        self.doc = doc
        self.__dict = settings_dict if settings_dict else {}
        self.user = None

    def to_paragraph(self) -> DocParagraph:
        text = '```\n' + yaml.dump(self.__dict, default_flow_style=False) + '\n```'
        return DocParagraph.create(self.doc, md=text, attrs={"settings": ""})

    def get_dict(self) -> dict:
        return self.__dict

    def global_plugin_attrs(self) -> dict:
        return self.__dict.get(self.global_plugin_attrs_key, {})

    def css(self):
        return self.__dict.get(self.css_key)

    def get_macroinfo(self, user=None, key=None) -> MacroInfo:
        if not key:
            key=self.macros_key
        return MacroInfo(self.doc, macro_map=self.__dict.get(key, {}),
                         macro_delimiter=self.get_macro_delimiter(),
                         user=user, nocache_user=self.user)

    def get_macro_delimiter(self) -> str:
        return self.__dict.get(self.macro_delimiter_key, '%%')

    def get_globalmacros(self) -> str:
        return self.__dict.get(self.globalmacros_key, {})

    def auto_number_questions(self) -> bool:
        return self.__dict.get(self.no_question_auto_numbering_key, False)

    def get_source_document(self) -> Optional[int]:
        return self.__dict.get(self.source_document_key)

    def get_slide_background_url(self, default=None) -> Optional[str]:
        return self.__dict.get(self.slide_background_url_key, default)

    def get_slide_background_color(self, default=None) -> Optional[str]:
        return self.__dict.get(self.slide_background_color_key, default)

    def get_bookmarks(self, default=None):
        if default is None:
            default = []
        return self.__dict.get(self.bookmark_key, default)

    def get_print_settings(self, default=None):
        if default is None:
            default = []
        return self.__dict.get(self.print_settings_key, default)

    def lazy(self, default=False):
        return self.__dict.get(self.lazy_key, default)

    def set_bookmarks(self, bookmarks: List[Dict]):
        self.__dict[self.bookmark_key] = bookmarks

    def set_source_document(self, source_docid: Optional[int]):
        self.__dict[self.source_document_key] = source_docid

    def auto_number_headings(self) -> int:
        return self.__dict.get(self.auto_number_headings_key, 0)

    def auto_number_start(self) -> int:
        return self.__dict.get(self.auto_number_start_key, False)

    def heading_format(self) -> dict:
        level = self.auto_number_headings()
        defaults = {1: '{h1}. {text}',
                    2: '{h1}.{h2} {text}',
                    3: '{h1}.{h2}.{h3} {text}',
                    4: '{h1}.{h2}.{h3}.{h4} {text}',
                    5: '{h1}.{h2}.{h3}.{h4}.{h5} {text}',
                    6: '{h1}.{h2}.{h3}.{h4}.{h5}.{h6} {text}'}
        if level == 2:
            defaults = {
                1: '{text}',
                2: '{h2}. {text}',
                3: '{h2}.{h3} {text}',
                4: '{h2}.{h3}.{h4} {text}',
                5: '{h2}.{h3}.{h4}.{h5} {text}',
                6: '{h2}.{h3}.{h4}.{h5}.{h6} {text}'
            }
        if level == 3:
            defaults = {
                1: '{text}',
                2: '{text}',
                3: '{h3}. {text}',
                4: '{h3}.{h4} {text}',
                5: '{h3}.{h4}.{h5} {text}',
                6: '{h3}.{h4}.{h5}.{h6} {text}'
            }
        if level == 4:
            defaults = {
                1: '{text}',
                2: '{text}',
                3: '{text}',
                4: '{h4}. {text}',
                5: '{h4}.{h5} {text}',
                6: '{h4}.{h5}.{h6} {text}'
            }
        hformat = self.__dict.get(self.heading_format_key)
        if hformat is None:
            return defaults
        return {1: hformat.get(1, defaults[1]),
                2: hformat.get(2, defaults[2]),
                3: hformat.get(3, defaults[3]),
                4: hformat.get(4, defaults[4]),
                5: hformat.get(5, defaults[5]),
                6: hformat.get(6, defaults[6])}

    def show_task_summary(self, default=False) -> bool:
        return self.__dict.get(self.show_task_summary_key, default)

    def hide_links(self, default=None):
        return self.__dict.get(self.hide_links_key, default)

    def point_sum_rule(self, default=None):
        return self.__dict.get(self.point_sum_rule_key, default)

    def max_points(self, default=None):
        return self.__dict.get(self.max_points_key, default)

    def live_updates(self, default=None):
        return self.__dict.get(self.live_updates_key, default)

    def plugin_md(self, default=True):
        return self.__dict.get(self.plugin_md_key, default)

    def get(self, key, default=None):
        return self.__dict.get(key, default)

    def is_texplain(self):
        texplain = self.__dict.get('texplain', False)
        return texplain
