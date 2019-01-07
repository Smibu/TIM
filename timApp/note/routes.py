from flask import Blueprint
from flask import abort
from flask import request

from timApp.auth.accesshelper import verify_comment_right, verify_logged_in, has_ownership, get_doc_or_abort
from timApp.auth.accesshelper import verify_view_access
from timApp.auth.sessioninfo import get_current_user_object
from timApp.document.document import Document
from timApp.document.editing.routes import par_response
from timApp.markdown.markdownconverter import md_to_html
from timApp.note.notes import tagstostr
from timApp.note.usernote import get_comment_by_id, UserNote
from timApp.notification.notification import NotificationType
from timApp.notification.notify import notify_doc_watchers
from timApp.timdb.exceptions import TimDbException
from timApp.timdb.sqa import db
from timApp.util.flask.requesthelper import get_referenced_pars_from_req, verify_json_params
from timApp.util.flask.responsehelper import json_response
from timApp.util.utils import get_current_time

notes = Blueprint('notes',
                  __name__,
                  url_prefix='')

KNOWN_TAGS = ['difficult', 'unclear']


def has_note_edit_access(n: UserNote):
    d = get_doc_or_abort(n.doc_id)
    g = get_current_user_object().get_personal_group()
    return n.usergroup == g or has_ownership(d)


def get_comment_and_check_exists(note_id: int):
    note = get_comment_by_id(note_id)
    if not note:
        return abort(404, 'Comment not found. It may have been deleted.')
    return note


@notes.route("/note/<int:note_id>")
def get_note(note_id):
    note = get_comment_and_check_exists(note_id)
    if not has_note_edit_access(note):
        return abort(403)
    return json_response({'text': note.content, 'extraData': note})


def check_note_access_ok(is_public: bool, doc: Document):
    if is_public and doc.get_settings().comments() == 'private':
        return abort(403, 'Only private comments can be posted on this document.')


@notes.route("/postNote", methods=['POST'])
def post_note():
    note_text, access, doc_id, par_id = verify_json_params('text', 'access', 'docId', 'par')
    is_public = access == "everyone"
    sent_tags, = verify_json_params('tags', require=False, default={})
    tags = []
    for tag in KNOWN_TAGS:
        if sent_tags.get(tag):
            tags.append(tag)
    docentry = get_doc_or_abort(doc_id)
    verify_comment_right(docentry)
    doc = docentry.document
    check_note_access_ok(is_public, doc)
    try:
        par = doc.get_paragraph(par_id)
    except TimDbException as e:
        return abort(404, str(e))

    par = get_referenced_pars_from_req(par)[0]
    n = UserNote(usergroup=get_current_user_object().get_personal_group(),
                 doc_id=par.get_doc_id(),
                 par_id=par.get_id(),
                 par_hash=par.get_hash(),
                 content=note_text,
                 access=access,
                 html=md_to_html(note_text),
                 tags=tagstostr(tags))
    db.session.add(n)

    if is_public:
        notify_doc_watchers(docentry, note_text, NotificationType.CommentAdded, par)
    return par_response([doc.get_paragraph(par_id)],
                        doc)


@notes.route("/editNote", methods=['POST'])
def edit_note():
    verify_logged_in()
    jsondata = request.get_json()
    note_id = int(jsondata['id'])
    n = get_comment_and_check_exists(note_id)
    d = get_doc_or_abort(n.doc_id)
    verify_view_access(d)
    note_text = jsondata['text']
    access = jsondata['access']
    par_id = n.par_id
    is_public = access == "everyone"
    check_note_access_ok(is_public, d.document)
    try:
        par = d.document.get_paragraph(par_id)
    except TimDbException as e:
        return abort(400, str(e))

    sent_tags = jsondata.get('tags', {})
    tags = []
    for tag in KNOWN_TAGS:
        if sent_tags.get(tag):
            tags.append(tag)
    if not has_note_edit_access(n):
        abort(403, "Sorry, you don't have permission to edit this note.")
    n.content = note_text
    n.html = md_to_html(note_text)
    n.access = access
    n.tags = tagstostr(tags)
    n.modified = get_current_time()

    if access == "everyone":
        notify_doc_watchers(d, note_text, NotificationType.CommentModified, par)
    doc = d.document
    return par_response([doc.get_paragraph(par_id)],
                        doc)


@notes.route("/deleteNote", methods=['POST'])
def delete_note():
    doc_id, note_id, paragraph_id = verify_json_params('docId', 'id', 'par')
    note = get_comment_and_check_exists(note_id)
    d = get_doc_or_abort(doc_id)
    if not has_note_edit_access(note):
        abort(403, "Sorry, you don't have permission to remove this note.")
    par_id = note.par_id
    try:
        par = d.document.get_paragraph(par_id)
    except TimDbException:
        return abort(400, 'Cannot delete the note because the paragraph has been deleted.')
    db.session.delete(note)
    if note.access == "everyone":
        notify_doc_watchers(d, note.content, NotificationType.CommentDeleted, par)
    doc = d.document
    return par_response([doc.get_paragraph(paragraph_id)],
                        doc)
