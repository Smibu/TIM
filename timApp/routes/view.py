"""Routes for document view."""

from contracts import contract, new_contract

from documentmodel.document import DocParagraph

new_contract('range', 'tuple(int, int)')

from flask import Blueprint, render_template, url_for
from .common import *
import pluginControl

view_page = Blueprint('view_page',
                      __name__,
                      url_prefix='')


# @cache.memoize(3600)
def get_whole_document(document_id):
    pars = [par for par in getTimDb().documents.get_document_with_autoimport(DocIdentifier(id=document_id, hash=''))]
    return pars

@contract
def get_partial_document(document_id: 'int', view_range: 'range') -> 'list(DocParagraph)':
    i = 0
    pars = []
    for par in Document(document_id):
        if i >= view_range[1]:
            break
        if i >= view_range[0]:
            pars.append(par)
        i += 1
    return pars

@contract
def get_document(doc_id: 'int', view_range: 'range|None' = None) -> 'list(DocParagraph)':
    # Separated into 2 functions for optimization
    # (don't cache partial documents and don't check ranges in the loop for whole ones)
    return get_whole_document(doc_id) if view_range is None else get_partial_document(doc_id, view_range)


@view_page.route("/view_content/<path:doc_name>")
def view_document_content(doc_name):
    try:
        view_range = parse_range(request.args.get('b'), request.args.get('e'))
        return view_content(doc_name, 'view_content.html', view_range=view_range)
    except (ValueError, TypeError):
        abort(400, "Invalid start or end index specified.")


@view_page.route("/view/<path:doc_name>")
@view_page.route("/view_html/<path:doc_name>")
@view_page.route("/doc/<path:doc_name>")
def view_document(doc_name):
    try:
        view_range = parse_range(request.args.get('b'), request.args.get('e'))
        return view(doc_name, 'view_html.html', view_range=view_range)
    except (ValueError, TypeError):
        abort(400, "Invalid start or end index specified.")


@view_page.route("/teacher/<path:doc_name>")
def teacher_view(doc_name):
    try:
        view_range = parse_range(request.args.get('b'), request.args.get('e'))
        usergroup = request.args.get('group')
        return view(doc_name, 'view_html.html', view_range=view_range, usergroup=usergroup, teacher=True)
    except (ValueError, TypeError):
        abort(400, "Invalid start or end index specified.")


@view_page.route("/lecture/<path:doc_name>")
def lecture_view(doc_name):
    try:
        view_range = parse_range(request.args.get('b'), request.args.get('e'))
        return view(doc_name, 'view_html.html', view_range, lecture=True)
    except (ValueError, TypeError):
        abort(400, "Invalid start or end index specified.")


@contract
def parse_range(start_index: 'int|None', end_index: 'int|None') -> 'range|None':
    if start_index is None and end_index is None:
        return None

    return( int(start_index), int(end_index) )


def try_return_folder(doc_name):
    timdb = getTimDb()
    folder_name = doc_name.rstrip('/')
    block_id = timdb.folders.get_folder_id(folder_name)

    if block_id is None:
        abort(404)

    possible_groups = timdb.users.getUserGroupsPrintable(getCurrentUserId())
    return render_template('index.html',
                           docID=block_id,
                           userName=getCurrentUserName(),
                           userId=getCurrentUserId(),
                           userGroups=possible_groups,
                           is_owner=hasOwnership(block_id),
                           docName=folder_name)


def view_content(doc_name, template_name, view_range=None, usergroup=None, teacher=False, lecture=False):
    timdb = getTimDb()
    doc_id = timdb.documents.get_document_id(doc_name)
    if doc_id is None or not timdb.documents.documentExists(doc_id):
        # Backwards compatibility: try to use as document id
        try:
            doc_id = int(doc_name)
            if not timdb.documents.documentExists(doc_id):
                return try_return_folder(doc_name)
            doc_name = timdb.documents.get_first_document_name(doc_id)
        except ValueError:
            return try_return_folder(doc_name)

    if teacher:
        verifyOwnership(doc_id)

    if not hasViewAccess(doc_id):
        if not loggedIn():
            session['came_from'] = request.url
            return render_template('loginpage.html', target_url=url_for('login_page.loginWithKorppi'), came_from=request.url)
        else:
            abort(403)

    start_index = max(view_range[0], 0) if view_range else 0
    xs = get_document(doc_id, view_range)
    user = getCurrentUserId()

    if teacher:
        task_ids = pluginControl.find_task_ids(xs, doc_id)
        user_list = None
        if usergroup is not None:
            user_list = [user['id'] for user in timdb.users.get_users_for_group(usergroup)]
        users = timdb.answers.getUsersForTasks(task_ids, user_list)
        if len(users) > 0:
            user = users[0]['id']
    else:
        users = []
    current_user = timdb.users.getUser(user)
    texts, jsPaths, cssPaths, modules = pluginControl.pluginify(xs,
                                                                current_user['name'],
                                                                timdb.answers,
                                                                doc_id,
                                                                current_user['id'],
                                                                sanitize=False)
    # TODO: Check if doc variable is needed
    return render_template(template_name,
                           text=texts,
                           plugin_users=users,
                           current_user=current_user,
                           js=jsPaths,
                           cssFiles=cssPaths,
                           jsMods=modules,
                           start_index=start_index,
                           group=usergroup,
                           rights={'editable': hasEditAccess(doc_id),
                                   'can_mark_as_read': hasReadMarkingRight(doc_id)
                                   })


def view(doc_name, template_name, view_range=None, usergroup=None, teacher=False, lecture=False):
    timdb = getTimDb()
    doc_id = timdb.documents.get_document_id(doc_name)
    if doc_id is None or not timdb.documents.documentExists(doc_id):
        # Backwards compatibility: try to use as document id
        try:
            doc_id = int(doc_name)
            if not timdb.documents.documentExists(doc_id):
                return try_return_folder(doc_name)
            doc_name = timdb.documents.get_first_document_name(doc_id)
        except ValueError:
            return try_return_folder(doc_name)

    if teacher:
        verifyOwnership(doc_id)

    if not hasViewAccess(doc_id):
        if not loggedIn():
            session['came_from'] = request.url
            return render_template('loginpage.html', target_url=url_for('login_page.loginWithKorppi'), came_from=request.url)
        else:
            abort(403)

    start_index = max(view_range[0], 0) if view_range else 0
    xs = get_document(doc_id, view_range)
    user = getCurrentUserId()

    if teacher:
        task_ids = pluginControl.find_task_ids(xs, doc_id)
        user_list = None
        if usergroup is not None:
            user_list = [user['id'] for user in timdb.users.get_users_for_group(usergroup)]
        users = timdb.answers.getUsersForTasks(task_ids, user_list)
        if len(users) > 0:
            user = users[0]['id']
    else:
        users = []
    current_user = timdb.users.getUser(user)
    texts, jsPaths, cssPaths, modules = pluginControl.pluginify(xs,
                                                                current_user['name'],
                                                                timdb.answers,
                                                                doc_id,
                                                                current_user['id'],
                                                                sanitize=False)

    reqs = pluginControl.get_all_reqs()

    if hide_names_in_teacher(doc_id):
        pass
        if not timdb.users.userIsOwner(current_user['id'], doc_id)\
           and current_user['id'] != getCurrentUserId():
            current_user['name'] = '-'
            current_user['real_name'] = 'Undisclosed student'
        for user in users:
            if not timdb.users.userIsOwner(user['id'], doc_id)\
               and user['id'] != getCurrentUserId():
                user['name'] = '-'
                user['real_name'] = 'Undisclosed student %d' % user['id']

    modules.append("ngSanitize")
    modules.append("angularFileUpload")
    prefs = timdb.users.getPrefs(getCurrentUserId())
    custom_css_files = json.loads(prefs).get('css_files', {}) if prefs is not None else {}
    if custom_css_files:
        custom_css_files = {key: value for key, value in custom_css_files.items() if value}
    custom_css = json.loads(prefs).get('custom_css', '') if prefs is not None else ''
    try:
        editortab = session['editortab']
    except KeyError:
        editortab = None
    # TODO: Check if doc variable is needed
    return render_template(template_name,
                           docID=doc_id,
                           docName=doc_name,
                           text=texts,
                           plugin_users=users,
                           current_user=current_user,
                           version=Document(doc_id).get_version(),
                           js=jsPaths,
                           cssFiles=cssPaths,
                           jsMods=modules,
                           custom_css_files=custom_css_files,
                           custom_css=custom_css,
                           start_index=start_index,
                           teacher_mode=teacher,
                           lecture_mode=lecture,
                           is_owner=hasOwnership(doc_id),
                           group=usergroup,
                           rights={'editable': hasEditAccess(doc_id),
                                   'can_mark_as_read': hasReadMarkingRight(doc_id),
                                   'can_comment': hasCommentRight(doc_id),
                                   'browse_own_answers': loggedIn()
                                   },
                           reqs=reqs,
                           editortab=editortab)
