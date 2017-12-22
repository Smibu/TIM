from typing import List, Optional

from timApp.accesshelper import has_view_access
from timApp.documentmodel.docparagraph import DocParagraph
from timApp.documentmodel.document import Document
from timApp.documentmodel.exceptions import ValidationException
from timApp.requesthelper import verify_json_params
from timApp.timdb.models.docentry import DocEntry


class EditRequest:
    def __init__(self, doc: Document, area_start: str = None, area_end: str = None, par: str = None, text: str = None,
                 next_par_id: str = None, preview: bool = False, forced_classes: Optional[List[str]]=None):
        self.forced_classes = forced_classes or []
        self.doc = doc
        self.preview = preview
        self.old_doc_version = doc.get_version()
        self.area_start = area_start
        self.area_end = area_end
        self.next_par_id = next_par_id
        self.par = par
        self.text = text
        self.editor_pars = None
        self.original_par = self.doc.get_paragraph(self.par) if not self.editing_area and par is not None and not self.is_adding else None
        self.context_par = self.get_context_par()

    @property
    def is_adding(self):
        return self.par in ('NEW_PAR', 'HELP_PAR') or self.par is None

    @property
    def editing_area(self) -> bool:
        return self.area_start is not None and self.area_end is not None

    def get_original_par(self) -> Optional[DocParagraph]:
        return self.original_par

    def get_last_of_preamble(self) -> Optional[DocParagraph]:
        preamble = list(self.doc.get_docinfo().get_preamble_pars())  # TODO could be optimized
        self.doc.insert_preamble_pars(preamble)
        return preamble[-1] if preamble else None

    def get_context_par(self) -> DocParagraph:
        doc = self.doc
        if self.editing_area:
            context_par = doc.get_previous_par_by_id(self.area_start)
        elif not self.is_adding:
            context_par = doc.get_previous_par_by_id(self.par)
            if context_par is None:
                return self.get_last_of_preamble()
        elif self.next_par_id:
            context_par = doc.get_previous_par_by_id(self.next_par_id)
            if context_par is None:
                return self.get_last_of_preamble()
        else:
            context_par = doc.get_last_par()
        return context_par

    def get_pars(self, skip_access_check: bool = False):
        if self.editor_pars is None:
            self.editor_pars = get_pars_from_editor_text(self.doc, self.text, break_on_elements=self.editing_area,
                                                         skip_access_check=skip_access_check)
            for c in self.forced_classes:
                for p in self.editor_pars:
                    p.add_class(c)
        return self.editor_pars

    @staticmethod
    def from_request(doc: Document, text: Optional[str] = None, preview: bool = False) -> 'EditRequest':
        if text is None:
            text, = verify_json_params('text')
        area_start, area_end, par, par_next, forced_classes = verify_json_params('area_start', 'area_end', 'par',
                                                                                 'par_next', 'forced_classes',
                                                                                 require=False)
        return EditRequest(doc=doc,
                           text=text,
                           area_start=area_start,
                           area_end=area_end,
                           par=par,
                           next_par_id=par_next,
                           preview=preview,
                           forced_classes=forced_classes)


def get_pars_from_editor_text(doc: Document, text: str,
                              break_on_elements: bool = False, skip_access_check: bool = False) -> List[DocParagraph]:
    blocks, validation_result = doc.text_to_paragraphs(text, break_on_elements)
    for p in blocks:
        if p.is_reference():
            try:
                refdoc = int(p.get_attr('rd'))
            except (ValueError, TypeError):
                continue
            d = DocEntry.find_by_id(refdoc, try_translation=True)
            if not skip_access_check and d \
                    and not has_view_access(d):
                raise ValidationException(f"You don't have view access to document {refdoc}")
    return blocks
