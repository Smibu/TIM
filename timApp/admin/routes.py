import os
import shutil

from flask import flash, url_for, Blueprint, abort

from timApp.auth.accesshelper import verify_admin
from timApp.auth.accesstype import AccessType
from timApp.document.docinfo import move_document
from timApp.tim_app import app
from timApp.timdb.sqa import db
from timApp.user.user import User
from timApp.util.flask.responsehelper import safe_redirect, json_response

admin_bp = Blueprint('admin',
                     __name__,
                     url_prefix='')


@admin_bp.route('/exception', methods=['GET', 'POST', 'PUT', 'DELETE'])
def throw_ex():
    verify_admin()
    raise Exception('This route throws an exception intentionally for testing purposes.')


@admin_bp.route('/restart')
def restart_server():
    """Restarts the server by sending HUP signal to Gunicorn."""
    verify_admin()
    pid_path = '/var/run/gunicorn.pid'
    if os.path.exists(pid_path):
        os.system(f'kill -HUP $(cat {pid_path})')
        flash('Restart signal was sent to Gunicorn.')
    else:
        flash('Gunicorn PID file was not found. TIM was probably not started with Gunicorn.')
    return safe_redirect(url_for('start_page'))


@admin_bp.route('/resetcss')
def reset_css():
    """Removes CSS cache directories and thereby forces SASS to regenerate them the next time they are needed.

    Requires admin privilege.
    :return: ok_response

    """
    verify_admin()
    assets_dir = os.path.join('static', '.webassets-cache')
    if os.path.exists(assets_dir):
        shutil.rmtree(assets_dir)
    gen_dir = os.path.join('static', app.config['SASS_GEN_PATH'])
    if os.path.exists(gen_dir):
        shutil.rmtree(gen_dir)
    return safe_redirect(url_for('start_page'))


@admin_bp.route('/users/search/<term>')
def search_users(term: str):
    verify_admin()
    result = User.query.filter(
        User.name.ilike(f'%{term}%') |
        User.real_name.ilike(f'%{term}%') |
        User.email.ilike(f'%{term}%')).all()
    return json_response(result)


def has_anything_in_common(u1: User, u2: User):
    u1_set = {u1.name.lower(), u1.real_name.lower(), u1.email_name_part.lower()}
    u2_set = {u2.name.lower(), u2.real_name.lower(), u2.email_name_part.lower()}
    if u1_set & u2_set:
        return True
    # This allows e.g. testuser1 and testuser2 to be merged.
    return bool(set(n[:-1] for n in u1_set) & set(n[:-1] for n in u2_set))


@admin_bp.route('/users/merge/<primary>/<secondary>')
def merge_users(primary, secondary):
    """Merges two users by moving data from secondary account to primary account.

    This does not delete accounts.
    """
    verify_admin()
    u_prim = User.get_by_name(primary)
    u_sec = User.get_by_name(secondary)
    if not u_prim:
        return abort(404, f'User {primary} not found')
    if not u_sec:
        return abort(404, f'User {secondary} not found')
    if u_prim.is_special:
        return abort(400, f'User {primary} is a special user')
    if u_sec.is_special:
        return abort(400, f'User {secondary} is a special user')
    if u_prim == u_sec:
        return abort(400, 'Users cannot be the same')
    if not has_anything_in_common(u_prim, u_sec):
        return abort(400, f'Users {primary} and {secondary} do not appear to be duplicates. '
                          f'Merging not allowed to prevent accidental errors.')

    moved_data = {}
    for a in ('owned_lectures', 'lectureanswers', 'messages', 'answers', 'annotations', 'velps'):
        a_alt = a + '_alt'
        moved_data[a] = len(getattr(u_sec, a_alt))
        getattr(u_prim, a_alt).extend(getattr(u_sec, a_alt))
        setattr(u_sec, a_alt, [])

    u_prim_group = u_prim.get_personal_group()
    u_sec_group = u_sec.get_personal_group()

    u_prim_folder = u_prim.get_personal_folder()
    u_sec_folder = u_sec.get_personal_folder()
    docs = u_sec_folder.get_all_documents(include_subdirs=True)
    for d in docs:
        move_document(d, u_prim_folder)

    for a in ('readparagraphs', 'notes', 'accesses'):
        a_alt = a + '_alt'
        moved_data[a] = len(getattr(u_sec_group, a_alt))
        getattr(u_prim_group, a_alt).extend(getattr(u_sec_group, a_alt))
        setattr(u_sec_group, a_alt, [])

    # Restore ownership of secondary's personal folder:
    # * all users are allowed to have at most one personal folder
    # * if we don't restore access for secondary user, a new personal folder would be created when logging in
    for a in u_prim_group.accesses:
        if a.block_id == u_sec_folder.block.id and a.type == AccessType.owner.value:
            moved_data['accesses'] -= 1
            u_prim_group.accesses.remove(a)
            u_sec_group.accesses.append(a)
            break

    db.session.commit()
    return json_response({
        'moved': moved_data,
    })
