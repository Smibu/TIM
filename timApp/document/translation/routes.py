import re

from flask import request, abort, Blueprint
from sqlalchemy.exc import IntegrityError

from timApp.auth.accesshelper import get_doc_or_abort, verify_view_access, verify_manage_access, has_manage_access
from timApp.auth.sessioninfo import get_current_user_group
from timApp.document.documents import create_translation
from timApp.document.translation.translation import Translation
from timApp.item.block import copy_default_rights
from timApp.item.blocktypes import blocktypes
from timApp.timdb.exceptions import ItemAlreadyExistsException
from timApp.timdb.sqa import db
from timApp.util.flask.requesthelper import verify_json_params
from timApp.util.flask.responsehelper import json_response, ok_response


def valid_language_id(lang_id):
    return re.match('^\w+$', lang_id) is not None


tr_bp = Blueprint('translation',
                  __name__,
                  url_prefix='')


@tr_bp.route("/translate/<int:tr_doc_id>/<language>", methods=["POST"])
def create_translation_route(tr_doc_id, language):
    title = request.get_json().get('doc_title', None)

    doc = get_doc_or_abort(tr_doc_id)

    verify_view_access(doc)
    if not valid_language_id(language):
        abort(404, 'Invalid language identifier')
    if doc.has_translation(language):
        raise ItemAlreadyExistsException('Translation for this language already exists')
    verify_manage_access(doc.src_doc)

    src_doc = doc.src_doc.document
    cite_doc = create_translation(src_doc, get_current_user_group())
    # noinspection PyArgumentList
    tr = Translation(doc_id=cite_doc.doc_id, src_docid=src_doc.doc_id, lang_id=language)
    tr.title = title
    db.session.add(tr)
    copy_default_rights(cite_doc.doc_id, blocktypes.DOCUMENT)
    db.session.commit()
    return json_response(tr)


@tr_bp.route("/translation/<int:doc_id>", methods=["POST"])
def update_translation(doc_id):
    (lang_id, doc_title) = verify_json_params('new_langid', 'new_title', require=True)
    if not valid_language_id(lang_id):
        abort(403, 'Invalid language identifier')
    doc = get_doc_or_abort(doc_id)
    if not has_manage_access(doc) and not has_manage_access(doc):
        abort(403, "You need manage access of either this or the translated document")
    doc.lang_id = lang_id
    doc.title = doc_title
    try:
        db.session.commit()
    except IntegrityError:
        raise ItemAlreadyExistsException('This language already exists.')
    return ok_response()


@tr_bp.route("/translations/<int:doc_id>", methods=["GET"])
def get_translations(doc_id):
    d = get_doc_or_abort(doc_id)
    verify_manage_access(d)

    return json_response(d.translations)
