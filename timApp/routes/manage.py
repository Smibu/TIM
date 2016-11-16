"""Routes for manage view."""
from flask import Blueprint, render_template

from options import get_option
from routes.accesshelper import verify_manage_access, verify_ownership, get_rights, verify_view_access, \
    has_manage_access
from timdb.blocktypes import from_str
from timdb.models.docentry import DocEntry
from timdb.models.folder import Folder
from timdb.models.usergroup import UserGroup
from .common import *

manage_page = Blueprint('manage_page',
                        __name__,
                        url_prefix='')  # TODO: Better URL prefix.


@manage_page.route("/manage/<path:path>")
def manage(path):
    timdb = get_timdb()
    is_folder = False
    doc = DocEntry.find_by_path(path, fallback_to_id=True, try_translation=True)
    folder = None
    if doc is None:
        folder = Folder.find_by_path(path, fallback_to_id=True)
        if folder is None:
            abort(404)
        is_folder = True
        block_id = folder.id
    else:
        block_id = doc.id

    if not has_manage_access(block_id):
        if verify_view_access(block_id):
            flash("Did someone give you a wrong link? Showing normal view instead of manage view.")
            return redirect('/view/' + str(block_id))

    access_types = timdb.users.get_access_types()

    if is_folder:
        item = folder
    else:
        item = doc.to_json()
        item['versions'] = doc.document.get_changelog(get_option(request, 'history', 100))
        item['fulltext'] = doc.document.export_markdown()
        for ver in item['versions']:
            ver['group'] = timdb.users.get_user_group_name(ver.pop('group_id'))

    return render_template('manage_folder.html' if is_folder else 'manage_document.html',
                           route='manage',
                           translations=timdb.documents.get_translations(block_id) if not is_folder else None,
                           item=item,
                           access_types=access_types)


@manage_page.route("/changelog/<int:doc_id>/<int:length>")
def get_changelog(doc_id, length):
    verify_manage_access(doc_id)
    doc = Document(doc_id)
    return jsonResponse({'versions': doc.get_changelog(length)})


@manage_page.route("/changeOwner/<int:doc_id>/<new_owner_name>", methods=["PUT"])
def change_owner(doc_id, new_owner_name):
    timdb = get_timdb()
    if not timdb.documents.exists(doc_id) and not timdb.folders.exists(doc_id):
        abort(404)
    verify_ownership(doc_id)
    new_owner = timdb.users.get_usergroup_by_name(new_owner_name)
    if new_owner is None:
        abort(404, 'Non-existent usergroup.')
    possible_groups = timdb.users.get_user_groups(get_current_user_id())
    if new_owner not in [group['id'] for group in possible_groups]:
        abort(403, "You must belong to the new usergroup.")
    timdb.documents.set_owner(doc_id, new_owner)
    return okJsonResponse()


@manage_page.route("/permissions/add/<int:item_id>/<group_name>/<perm_type>", methods=["PUT"])
def add_permission(item_id, group_name, perm_type):
    group_ids = verify_and_get_group(item_id, group_name)
    timdb = get_timdb()
    try:
        for group_id in group_ids:
            timdb.users.grant_access(group_id, item_id, perm_type, commit=False)
        timdb.commit()
    except KeyError:
        abort(400, 'Invalid permission type.')
    return okJsonResponse()


@manage_page.route("/permissions/remove/<int:item_id>/<int:group_id>/<perm_type>", methods=["PUT"])
def remove_permission(item_id, group_id, perm_type):
    timdb = get_timdb()
    verify_manage_access(item_id)
    try:
        timdb.users.remove_access(group_id, item_id, perm_type)
    except KeyError:
        abort(400, 'Unknown permission type')
    return okJsonResponse()


@manage_page.route("/alias/<int:doc_id>", methods=["GET"])
def get_doc_names(doc_id):
    timdb = get_timdb()
    names = timdb.documents.get_names(doc_id, include_nonpublic=True)
    return jsonResponse(names)


@manage_page.route("/alias/<int:doc_id>/<path:new_alias>", methods=["PUT"])
def add_alias(doc_id, new_alias):
    timdb = get_timdb()
    is_public = bool(request.get_json()['public'])

    new_alias = new_alias.strip('/')

    if not timdb.documents.exists(doc_id):
        return abort(404, 'The document does not exist!')

    if not timdb.users.has_manage_access(get_current_user_id(), doc_id):
        return abort(403, "You don't have permission to rename this object.")

    validate_item(new_alias, 'alias')

    parent_folder, _ = timdb.folders.split_location(new_alias)
    timdb.folders.create(parent_folder, get_current_user_group())
    timdb.documents.add_name(doc_id, new_alias, is_public)
    return okJsonResponse()


@manage_page.route("/alias/<int:doc_id>/<path:alias>", methods=["POST"])
def change_alias(doc_id, alias):
    timdb = get_timdb()
    alias = alias.strip('/')
    new_alias = request.get_json()['new_name'].strip('/')
    is_public = bool(request.get_json()['public'])

    doc_id2 = timdb.documents.get_document_id(alias)
    if doc_id2 is None:
        return abort(404, 'The document does not exist!')
    if doc_id2 != doc_id:
        return abort(404, 'The document name does not match the id!')

    if not timdb.users.has_manage_access(get_current_user_id(), doc_id):
        return abort(403, "You don't have permission to rename this object.")

    new_parent, _ = timdb.folders.split_location(new_alias)

    if alias != new_alias:
        if timdb.documents.get_document_id(new_alias) is not None or timdb.folders.get_folder_id(new_alias) is not None:
            return abort(403, 'Item with a same name already exists.')
        parent, _ = timdb.folders.split_location(alias)
        if not can_write_to_folder(parent):
            return abort(403, "You don't have permission to write to the source folder.")

    if not can_write_to_folder(new_parent):
        return abort(403, "You don't have permission to write to the destination folder.")

    timdb.folders.create(new_parent, get_current_user_group())
    timdb.documents.change_name(doc_id, alias, new_alias, is_public)
    return okJsonResponse()


@manage_page.route("/alias/<int:doc_id>/<path:alias>", methods=["DELETE"])
def remove_alias(doc_id, alias):
    timdb = get_timdb()
    alias = alias.strip('/')

    doc_id2 = timdb.documents.get_document_id(alias)
    if doc_id2 is None:
        return abort(404, 'The document does not exist!')
    if doc_id2 != doc_id:
        return abort(404, 'The document name does not match the id!')

    if not timdb.users.user_is_owner(get_current_user_id(), doc_id):
        return abort(403, "You don't have permission to delete this object.")

    if len(timdb.documents.get_document_names(doc_id, include_nonpublic=True)) < 2:
        return abort(403, "You can't delete the only name the document has.")

    parent_folder, _ = timdb.folders.split_location(alias)

    if not can_write_to_folder(parent_folder):
        return abort(403, "You don't have permission to write to that folder.")

    timdb.documents.delete_name(doc_id, alias)
    return okJsonResponse()


@manage_page.route("/rename/<int:doc_id>", methods=["PUT"])
def rename_folder(doc_id):
    timdb = get_timdb()
    new_name = request.get_json()['new_name'].strip('/')

    if timdb.documents.exists(doc_id):
        return abort(403, 'Rename route is no longer supported for documents.')

    if not timdb.folders.exists(doc_id):
        return abort(404, 'The folder does not exist!')

    if not timdb.users.has_manage_access(get_current_user_id(), doc_id):
        return abort(403, "You don't have permission to rename this object.")

    parent, _ = timdb.folders.split_location(new_name)
    parent_id = timdb.folders.get_folder_id(parent)

    if parent_id is None:
        # Maybe do a recursive create with permission checks here later?
        return abort(403, "The location does not exist.")

    if parent_id == doc_id:
        return abort(403, "A folder cannot contain itself.")

    validate_item(new_name, 'folder')

    timdb.folders.rename(doc_id, new_name)
    return jsonResponse({'new_name': new_name})


@manage_page.route("/permissions/get/<int:doc_id>")
def get_permissions(doc_id):
    timdb = get_timdb()
    verify_manage_access(doc_id)
    grouprights = timdb.users.get_rights_holders(doc_id)
    return jsonResponse({'grouprights': grouprights, 'accesstypes': timdb.users.get_access_types()})


@manage_page.route("/defaultPermissions/<object_type>/get/<int:folder_id>")
def get_default_document_permissions(folder_id, object_type):
    timdb = get_timdb()
    verify_manage_access(folder_id)
    grouprights = timdb.users.get_default_rights_holders(folder_id, from_str(object_type))
    return jsonResponse({'grouprights': grouprights})


@manage_page.route("/defaultPermissions/<object_type>/add/<int:folder_id>/<group_name>/<perm_type>", methods=["PUT"])
def add_default_doc_permission(folder_id, group_name, perm_type, object_type):
    group_ids = verify_and_get_group(folder_id, group_name)
    timdb = get_timdb()
    timdb.users.grant_default_access(group_ids, folder_id, perm_type, from_str(object_type))
    return okJsonResponse()


@manage_page.route("/defaultPermissions/<object_type>/remove/<int:folder_id>/<int:group_id>/<perm_type>", methods=["PUT"])
def remove_default_doc_permission(folder_id, group_id, perm_type, object_type):
    timdb = get_timdb()
    timdb.users.remove_default_access(group_id, folder_id, perm_type, from_str(object_type))
    return okJsonResponse()


def verify_and_get_group(folder_id, group_name):
    verify_manage_access(folder_id)
    groups = UserGroup.query.filter(UserGroup.name.in_(group_name.split(';'))).all()
    if len(groups) == 0:
        abort(404, 'No user group with this name was found.')
    group_ids = [group.id for group in groups]
    return group_ids


@manage_page.route("/documents/<int:doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    timdb = get_timdb()
    if not timdb.documents.exists(doc_id):
        return abort(404, 'Document does not exist.')
    if not timdb.users.user_is_owner(get_current_user_id(), doc_id):
        return abort(403, "You don't have permission to delete this document.")
    abort(403, 'Deleting documents has been disabled until a proper backup mechanism is implemented. '
               'Please contact TIM administrators if you really want to delete this document. '
               'You can hide this document from others by removing all permissions.')
    timdb.documents.delete(doc_id)
    return okJsonResponse()


@manage_page.route("/folders/<int:doc_id>", methods=["DELETE"])
def delete_folder(doc_id):
    timdb = get_timdb()
    if not timdb.folders.exists(doc_id):
        return abort(404, 'Folder does not exist.')
    if not timdb.users.user_is_owner(get_current_user_id(), doc_id):
        return abort(403, "You don't have permission to delete this folder.")
    if not timdb.folders.is_empty(doc_id):
        return abort(403, "The folder is not empty. Only empty folders can be deleted.")

    timdb.folders.delete(doc_id)
    return okJsonResponse()
