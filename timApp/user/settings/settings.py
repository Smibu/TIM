"""Routes for settings view."""

from flask import Blueprint, render_template
from flask import abort
from flask import request
from jinja2 import TemplateNotFound

from timApp.auth.accesshelper import verify_logged_in, verify_admin
from timApp.notification.notify import get_current_user_notifications
from timApp.util.flask.requesthelper import get_option
from timApp.util.flask.responsehelper import json_response
from timApp.auth.sessioninfo import get_current_user_object
from timApp.user.settings.theme import get_available_themes
from timApp.auth.accesstype import AccessType
from timApp.item.block import Block, BlockType
from timApp.document.docentry import DocEntry
from timApp.folder.folder import Folder
from timApp.user.user import User
from timApp.user.preferences import Preferences
from timApp.timdb.sqa import db
from timApp.auth.auth_models import BlockAccess
from timApp.answer.answer_models import AnswerUpload

settings_page = Blueprint('settings_page',
                          __name__,
                          url_prefix='/settings')


@settings_page.before_request
def verify_login():
    verify_logged_in()


@settings_page.route('')
def show():
    available_css_files = [{'name': theme.filename, 'desc': theme.description} for theme in get_available_themes()]

    try:
        return render_template('settings.html',
                               css_files=available_css_files,
                               notifications=get_current_user_notifications())
    except TemplateNotFound:
        abort(404)


@settings_page.route('/get')
def get_settings():
    return json_response(get_current_user_object().get_prefs())


@settings_page.route('/save', methods=['POST'])
def save_settings():
    try:
        j = request.get_json()
        get_current_user_object().set_prefs(Preferences.from_json(j))
    except TypeError:
        abort(400, f'Invalid settings: {j}')
    db.session.commit()
    show()  # Regenerate CSS
    return json_response(get_current_user_object().get_prefs())


@settings_page.route('/get/<name>')
def get_setting(name):
    prefs = get_current_user_object().get_prefs()
    return json_response({name: getattr(prefs, name, None)})


def get_user_info(u: User, include_doc_content=False):
    """Returns all data associated with a user."""
    block_query = u.get_personal_group().accesses.filter_by(type=AccessType.owner.value).with_entities(
        BlockAccess.block_id)
    docs = DocEntry.query.filter(DocEntry.id.in_(block_query)).all()
    folders = Folder.query.filter(Folder.id.in_(block_query)).all()
    images = Block.query.filter(Block.id.in_(block_query) & (Block.type_id == BlockType.Image.value)).all()
    files = Block.query.filter(Block.id.in_(block_query) & (Block.type_id == BlockType.File.value)).all()
    velpgroups = Block.query.filter(Block.id.in_(block_query) & (Block.type_id == BlockType.Velpgroup.value)).all()
    answers = u.answers.all()
    answer_uploads = AnswerUpload.query.filter(AnswerUpload.answer_id.in_([a.id for a in answers])).all()
    for d in docs:
        d.serialize_content = include_doc_content

    return {
        'annotations': u.annotations.all(),
        'answers': answers,
        'answer_uploads': answer_uploads,
        'groups': u.groups,
        'lectureanswers': u.lectureanswers.all(),
        'notes': u.get_personal_group().notes.all(),
        'owned_documents': docs,
        'owned_folders': folders,
        'owned_lectures': u.owned_lectures.all(),
        'readparagraphs': u.get_personal_group().readparagraphs.all(),
        'uploaded_images': images,
        'uploaded_files': files,
        'velpgroups': velpgroups,
        'velps': u.velps.all(),
    }


@settings_page.route('/info')
@settings_page.route('/info/<username>')
def get_info_route(username=None):
    verify_logged_in()
    if username:
        verify_admin()
        u = User.get_by_name(username)
        if not u:
            abort(404, 'User not found')
    else:
        u = get_current_user_object()
    include_doc_content = get_option(request, 'content', False)
    return json_response(get_user_info(u, include_doc_content))
