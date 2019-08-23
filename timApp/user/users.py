from typing import List

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from timApp.auth.auth_models import BlockAccess
from timApp.item.block import Block, BlockType
from timApp.timdb.sqa import db
from timApp.timdb.timdbbase import TimDbBase
from timApp.user.special_group_names import ANONYMOUS_USERNAME, ANONYMOUS_GROUPNAME, KORPPI_GROUPNAME, \
    LOGGED_IN_GROUPNAME, \
    LOGGED_IN_USERNAME, ADMIN_GROUPNAME, TEACHERS_GROUPNAME, GROUPADMIN_GROUPNAME
from timApp.user.user import User
from timApp.user.usergroup import UserGroup
from timApp.user.userutils import get_access_type_id, get_default_right_document


def remove_access(group_id: int, block_id: int, access_type: str):
    access_type_id = get_access_type_id(access_type)
    i = Block.query.get(block_id)
    for a in i.accesses:  # type: BlockAccess
        if a.usergroup_id == group_id and a.type == access_type_id:
            db.session.delete(a)
            break

RightsList = List[BlockAccess]


def get_rights_holders(block_id: int) -> RightsList:
    result = (BlockAccess.query
              .options(
        joinedload(BlockAccess.usergroup)
    )
              .options(joinedload(BlockAccess.atype))
              .filter_by(block_id=block_id)
              .join(UserGroup)
              .outerjoin(User, User.name == UserGroup.name)
              .with_entities(BlockAccess, UserGroup, User)
              .all()
     )
    results = []
    for acc, ug, user in result:
        if user:
            ug.personal_user = user
        results.append(acc)
    return results


def get_default_rights_holders(folder_id: int, object_type: BlockType) -> RightsList:
    doc = get_default_right_document(folder_id, object_type)
    if doc is None:
        return []
    return get_rights_holders(doc.id)


def remove_default_access(group_id: int, folder_id: int, access_type: str, object_type: BlockType):
    doc = get_default_right_document(folder_id, object_type, create_if_not_exist=True)
    remove_access(group_id, doc.id, access_type)


def create_special_usergroups(sess):
    """Creates all special usergroups."""

    anon = User(id=0, name=ANONYMOUS_USERNAME, real_name='Anonymous user')
    logged = User(name=LOGGED_IN_USERNAME)
    anon_group = UserGroup(name=ANONYMOUS_GROUPNAME)
    logged_group = UserGroup(id=0, name=LOGGED_IN_GROUPNAME)
    korppi_group = UserGroup(name=KORPPI_GROUPNAME)
    admin_group = UserGroup(name=ADMIN_GROUPNAME)
    teachers_group = UserGroup(name=TEACHERS_GROUPNAME)
    groupadmin_group = UserGroup(name=GROUPADMIN_GROUPNAME)
    anon.groups.append(anon_group)
    logged.groups.append(logged_group)
    sess.add(anon)
    sess.add(logged)
    sess.add(korppi_group)
    sess.add(admin_group)
    sess.add(teachers_group)
    sess.add(groupadmin_group)


def create_anonymous_user(name: str, real_name: str) -> User:
    """Creates a new anonymous user.

    :param name: The name of the user to be created.
    :param real_name: The real name of the user.
    :returns: The id of the newly created user.

    """

    next_id = User.query.with_entities(func.min(User.id)).scalar() - 1
    u, _ = User.create_with_group(uid=next_id, name=name + str(abs(next_id)), real_name=real_name)
    db.session.add(u)
    return u
