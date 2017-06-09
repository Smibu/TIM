import json
import os
import shutil

from timApp.documentmodel.document import Document
from timApp.documentmodel.docparagraph import DocParagraph, is_real_id
from timApp.documentmodel.documentparser import DocumentParser
from timApp.documentmodel.documentwriter import DocumentWriter
from timApp.documentmodel.randutils import random_id
from typing import Dict, List, Optional, Any

from timApp.timdb.timdbexception import TimDbException


class Clipboard:

    def __init__(self, files_root: str):
        self.files_root = files_root

    def get_path(self):
        return os.path.join(self.files_root, 'clipboard')

    def get(self, user_id: int):
        return Clipboard.UserClipboard(self, user_id)

    def clear_all(self):
        path = self.get_path()
        if os.path.exists(path):
            shutil.rmtree(path)

    class UserClipboard:

        def __init__(self, parent: 'Clipboard', user_id: int):
            self.user_id = user_id
            self.path = os.path.join(parent.get_path(), str(self.user_id))

        def get_metafilename(self) -> str:
            return os.path.join(self.path, 'metadata')

        def get_clipfilename(self) -> str:
            return os.path.join(self.path, 'content')

        def get_reffilename(self) -> str:
            return os.path.join(self.path, 'ref-content')

        def get_parreffilename(self) -> str:
            return os.path.join(self.path, 'ref-parcontent')

        def clear(self):
            for name in (self.get_clipfilename(), self.get_reffilename(), self.get_parreffilename(), self.get_metafilename()):
                if os.path.isfile(name):
                    os.remove(name)

        def clear_refs(self):
            for name in (self.get_reffilename(), self.get_parreffilename()):
                if os.path.isfile(name):
                    os.remove(name)

        def read_metadata(self) -> Dict[str, str]:
            try:
                with open(self.get_metafilename(), 'rt', encoding='utf-8') as metafile:
                    metadata = json.loads(metafile.read())
                metadata['empty'] = False
                return metadata
            except FileNotFoundError:
                return {'empty': True}

        def read(self, as_ref: Optional[bool] = False, force_parrefs: Optional[bool] = False)\
                -> Optional[List[Dict[str, str]]]:

            if as_ref:
                clipfilename = self.get_parreffilename() if force_parrefs else self.get_reffilename()
            else:
                clipfilename = self.get_clipfilename()

            if not os.path.isfile(clipfilename):
                return None
            with open(clipfilename, 'rt', encoding='utf-8') as clipfile:
                content = clipfile.read()
            return DocumentParser(content).validate_structure(is_whole_document=False).get_blocks()

        def write_metadata(self, **kwargs):
            os.makedirs(self.path, exist_ok=True)
            with open(self.get_metafilename(), 'wt', encoding='utf-8') as metafile:
                metafile.write(json.dumps(kwargs))

        def update_metadata(self, **kwargs):
            metadata = self.read_metadata()
            metadata.update(kwargs)
            self.write_metadata(**metadata)

        def write(self, pars: List[Dict[str, Any]]):
            os.makedirs(self.path, exist_ok=True)
            text = DocumentWriter(pars).get_text()
            with open(self.get_clipfilename(), 'wt', encoding='utf-8') as clipfile:
                clipfile.write(text)

        def write_refs(self, pars: List[DocParagraph], area_name: Optional[str]):
            os.makedirs(self.path, exist_ok=True)
            ref_pars = [p.create_reference(p.doc).dict() for p in pars]
            reftext = DocumentWriter(ref_pars).get_text()
            with open(self.get_parreffilename(), 'wt', encoding='utf-8') as reffile:
                reffile.write(reftext)

            if area_name and len(pars) > 0:
                os.makedirs(self.path, exist_ok=True)
                ref_pars = [DocParagraph.create_area_reference(pars[0].doc, area_name).dict()]
                reftext = DocumentWriter(ref_pars).get_text()
                with open(self.get_reffilename(), 'wt', encoding='utf-8') as reffile:
                    reffile.write(reftext)
            else:
                shutil.copy(self.get_parreffilename(), self.get_reffilename())

        def cut_pars(self, doc: Document, par_start: str, par_end: str,
                     area_name: Optional[str] = None) -> List[DocParagraph]:

            pars = self.copy_pars(doc, par_start, par_end, area_name, doc, disable_ref=True)
            doc.delete_section(par_start, par_end)
            self.update_metadata(last_action='cut')
            return pars

        def copy_pars(self, doc: Document, par_start: str, par_end: str, area_name: Optional[str] = None,
                      ref_doc: Optional[Document] = None, disable_ref: bool = False) -> List[DocParagraph]:

            par_objs = doc.get_section(par_start, par_end)
            pars = [p.dict() for p in par_objs]

            self.write_metadata(area_name=area_name, disable_ref=disable_ref, last_action='copy')
            self.write(pars)
            self.write_refs(par_objs, area_name)

            return par_objs

        def paste_before(self, doc: Document, par_id: str, as_ref: bool = False) -> List[DocParagraph]:
            pars = self.read(as_ref)
            if pars is None:
                raise TimDbException('There is nothing to paste.')

            metadata = self.read_metadata()
            if not as_ref and metadata.get('area_name') is not None and doc.named_section_exists(metadata['area_name']):
                new_area_name = metadata['area_name'] + '_' + random_id()
                pars[0]['attrs']['area'] = new_area_name
                pars[len(pars) - 1]['attrs']['area_end'] = new_area_name

            doc_pars = []
            par_before = par_id
            if is_real_id(par_before) and not doc.has_paragraph(par_before):
                raise TimDbException('Paragraph not found: {}'.format(par_before))
            for par in reversed(pars):
                # We need to reverse the sequence because we're inserting before, not after
                new_par_id = par['id'] if not doc.has_paragraph(par['id']) else random_id()
                new_par = doc.insert_paragraph(par['md'], insert_before_id=par_before, par_id=new_par_id,
                                               attrs=par.get('attrs'))
                doc_pars = [new_par] + doc_pars
                par_before = new_par.get_id()

            self.update_metadata(last_action='paste')
            return doc_pars

        def paste_after(self, doc: Document, par_id: str, as_ref: bool = False) -> List[DocParagraph]:
            par_before = None

            if is_real_id(par_id) and not doc.has_paragraph(par_id):
                raise TimDbException('Paragraph not found: {}'.format(par_id))
            # todo: make the iterator accept ranges
            i = doc.__iter__()
            try:
                while True:
                    if next(i).get_id() == par_id:
                        par_before = next(i).get_id()
                        raise StopIteration
            except StopIteration:
                pass
            finally:
                i.close()

            return self.paste_before(doc, par_before, as_ref)
