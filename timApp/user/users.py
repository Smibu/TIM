from collections import defaultdict
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from timApp.auth.accesstype import AccessType
from timApp.auth.auth_models import BlockAccess
from timApp.folder.folder import Folder
from timApp.item.block import Block, BlockType
from timApp.timdb.sqa import db
from timApp.user.special_group_names import (
    ANONYMOUS_USERNAME,
    ANONYMOUS_GROUPNAME,
    LOGGED_IN_GROUPNAME,
    LOGGED_IN_USERNAME,
    ADMIN_GROUPNAME,
    TEACHERS_GROUPNAME,
    GROUPADMIN_GROUPNAME,
)
from timApp.user.user import User, UserInfo, ItemOrBlock
from timApp.user.usergroup import UserGroup
from timApp.user.userutils import (
    get_default_right_document,
    get_or_create_default_right_document,
)


def remove_access(group: UserGroup, i: ItemOrBlock, access_type: AccessType):
    b = i if isinstance(i, Block) else i.block
    return b.accesses.pop((group.id, access_type.value), None)


RightsList = list[BlockAccess]


def get_rights_holders(block_id: int) -> RightsList:
    return get_rights_holders_all([block_id])[block_id]


def get_rights_holders_all(block_ids: list[int], order_by=None):
    if not order_by:
        order_by = User.name
    result: list[tuple[BlockAccess, UserGroup, User | None]] = (
        BlockAccess.query.options(
            joinedload(BlockAccess.usergroup)
            .joinedload(UserGroup.admin_doc)
            .joinedload(Block.docentries)
        )
        .options(joinedload(BlockAccess.atype))
        .filter(BlockAccess.block_id.in_(block_ids))
        .join(UserGroup)
        .outerjoin(User, User.name == UserGroup.name)
        .with_entities(BlockAccess, UserGroup, User)
        .order_by(order_by)
        .all()
    )
    results = defaultdict(list)
    for acc, ug, user in result:
        if user:
            ug.personal_user = user
        results[acc.block_id].append(acc)
    return results


def get_default_rights_holders(folder: Folder, object_type: BlockType) -> RightsList:
    doc = get_default_right_document(folder, object_type)
    if doc is None:
        return []
    return get_rights_holders(doc.id)


def remove_default_access(
    group, folder: Folder, access_type: AccessType, object_type: BlockType
):
    doc = get_or_create_default_right_document(folder, object_type)
    remove_access(group, doc, access_type)


def create_special_usergroups(sess):
    """Creates all special usergroups."""

    anon = User(id=0, name=ANONYMOUS_USERNAME, real_name="Anonymous user")
    logged = User(name=LOGGED_IN_USERNAME)
    anon_group = UserGroup(name=ANONYMOUS_GROUPNAME)
    logged_group = UserGroup(id=0, name=LOGGED_IN_GROUPNAME)
    admin_group = UserGroup(name=ADMIN_GROUPNAME)
    teachers_group = UserGroup(name=TEACHERS_GROUPNAME)
    groupadmin_group = UserGroup(name=GROUPADMIN_GROUPNAME)
    anon.groups.append(anon_group)
    logged.groups.append(logged_group)
    sess.add(anon)
    sess.add(logged)
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
    u, _ = User.create_with_group(
        UserInfo(username=name + str(abs(next_id)), full_name=real_name), uid=next_id
    )
    db.session.add(u)
    return u
