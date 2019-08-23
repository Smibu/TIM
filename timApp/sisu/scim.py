import json
import re
from typing import List, Optional, Dict

import attr
from flask import Blueprint, request, current_app, Response
from marshmallow import Schema, fields, post_load, ValidationError, missing, pre_load
from sqlalchemy.exc import IntegrityError
from webargs.flaskparser import use_args

from timApp.auth.login import create_or_update_user
from timApp.sisu.scimusergroup import ScimUserGroup, external_id_re
from timApp.sisu.sisu import parse_sisu_group_display_name, refresh_sisu_grouplist_doc
from timApp.tim_app import csrf
from timApp.timdb.sqa import db
from timApp.user.scimentity import get_meta
from timApp.user.user import User, UserOrigin, last_name_to_first
from timApp.user.usergroup import UserGroup, tim_group_to_scim, SISU_GROUP_PREFIX
from timApp.util.flask.responsehelper import json_response
from timApp.util.logger import log_warning
from timApp.util.utils import remove_path_special_chars

scim = Blueprint('scim',
                 __name__,
                 url_prefix='/scim')

DELETED_GROUP_PREFIX = 'deleted:'
CUMULATIVE_GROUP_PREFIX = 'cumulative:'

UNPROCESSABLE_ENTITY = 422


class SCIMNameSchema(Schema):
    familyName = fields.Str(required=True)
    givenName = fields.Str(required=True)
    middleName = fields.Str(allow_none=True)

    @post_load
    def make_obj(self, data):
        return SCIMNameModel(**data)


@attr.s(auto_attribs=True)
class SCIMNameModel:
    familyName: str
    givenName: str
    middleName: str = None

    def derive_full_name(self, last_name_first: bool):
        if last_name_first:
            full = f'{self.familyName} {self.givenName}'
            if self.middleName:
                full += f' {self.middleName}'
            return full
        else:
            if self.middleName:
                return f'{self.givenName} {self.middleName} {self.familyName}'
            else:
                return f'{self.givenName} {self.familyName}'


class SCIMMemberSchema(Schema):
    value = fields.Str(required=True)
    ref = fields.Str()
    display = fields.Str()
    name = fields.Nested(SCIMNameSchema)
    email = fields.Str()
    type = fields.Str()

    @pre_load
    def preload(self, data):
        if not isinstance(data, dict):
            return data
        ref = data.pop('$ref', None)
        if ref:
            data['ref'] = ref
        return data

    @post_load
    def make_obj(self, data):
        return SCIMMemberModel(**data)


@attr.s(auto_attribs=True)
class SCIMMemberModel:
    value: str
    name: Optional[SCIMNameModel] = None
    display: Optional[str] = None
    email: Optional[str] = None
    ref: Optional[str] = missing
    type: Optional[str] = missing


class SCIMCommonSchema(Schema):
    externalId = fields.Str(required=True)
    displayName = fields.Str(required=True)


@attr.s(auto_attribs=True)
class SCIMCommonModel:
    externalId: str
    displayName: str


@attr.s(auto_attribs=True)
class SCIMEmailModel:
    value: str
    type: str = missing
    primary: bool = missing


class SCIMEmailSchema(Schema):
    value = fields.Str(required=True)
    type = fields.Str()
    primary = fields.Bool()

    @post_load
    def make_obj(self, data):
        return SCIMEmailModel(**data)


class SCIMUserSchema(SCIMCommonSchema):
    userName = fields.Str(required=True)
    emails = fields.List(fields.Nested(SCIMEmailSchema), required=True)

    @post_load
    def make_obj(self, data):
        return SCIMUserModel(**data)


@attr.s(auto_attribs=True)
class SCIMUserModel(SCIMCommonModel):
    userName: str
    emails: List[SCIMEmailModel]


class SCIMGroupSchema(SCIMCommonSchema):
    id = fields.Str()
    schemas = fields.List(fields.Str())
    members = fields.List(fields.Nested(SCIMMemberSchema), required=True)

    @post_load
    def make_obj(self, data):
        return SCIMGroupModel(**data)


@attr.s(auto_attribs=True)
class SCIMGroupModel(SCIMCommonModel):
    members: List[SCIMMemberModel]
    id: Optional[str] = missing
    schemas: Optional[List[str]] = missing


@attr.s(auto_attribs=True)
class SCIMException(Exception):
    code: int
    msg: str
    headers: Optional[Dict[str, str]] = None


@scim.errorhandler(SCIMException)
def item_locked(error: SCIMException):
    log_warning(error.msg)
    return handle_error_msg_code(error.code, error.msg, error.headers)


def handle_error(error):
    return handle_error_msg_code(error.code, error.description)


def handle_error_msg_code(code: int, msg: str, headers=None):
    return json_response(
        scim_error_json(code, msg),
        status_code=code,
        headers=headers,
    )


scim.errorhandler(UNPROCESSABLE_ENTITY)(handle_error)


def scim_error_json(code, msg):
    return {
        "detail": msg,
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
        "status": str(code),
    }


@scim.before_request
def check_auth():
    expected_username = current_app.config.get('SCIM_USERNAME')
    expected_password = current_app.config.get('SCIM_PASSWORD')
    if not expected_username or not expected_password:
        raise SCIMException(403, 'SCIM username or password not configured.')
    headers = {'WWW-Authenticate': 'Basic realm="Authentication required"'}
    auth = request.authorization
    if not auth:
        raise SCIMException(401, 'This action requires authentication.', headers=headers)
    if auth.username == expected_username and auth.password == expected_password:
        pass
    else:
        raise SCIMException(401, 'Incorrect username or password.', headers=headers)


class GetGroupsSchema(Schema):
    filter = fields.Str(required=True)

    @post_load
    def post_load(self, data):
        return GetGroupsModel(**data)


@attr.s(auto_attribs=True)
class GetGroupsModel:
    filter: str


def get_scim_id(ug: UserGroup):
    return tim_group_to_scim(ug.name)


filter_re = re.compile('externalId sw (.+)')


def scim_group_to_tim(sisu_group: str):
    return f'{SISU_GROUP_PREFIX}{sisu_group}'


@scim.route('/Groups')
@use_args(GetGroupsSchema())
def get_groups(args: GetGroupsModel):
    m = filter_re.fullmatch(args.filter)
    if not m:
        raise SCIMException(422, 'Unsupported filter')
    groups = ScimUserGroup.query.filter(ScimUserGroup.external_id.startswith(scim_group_to_tim(m.group(1)))).join(
        UserGroup).with_entities(UserGroup).all()

    def gen_groups():
        for g in groups:  # type: UserGroup
            yield {
                'id': g.scim_id,
                'externalId': g.scim_id,
                'meta': get_meta(g),
            }

    return json_response({
        'schemas': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        'totalResults': len(groups),
        'Resources': list(gen_groups()),
    })


def derive_scim_group_name(s: str):
    x = parse_sisu_group_display_name(s)
    if not x:
        return remove_path_special_chars(s.lower())
    if x.period:
        return f'{x.coursecode.lower()}-{x.year[2:]}{x.period.lower()}-{x.desc_slug}'
    else:
        return f'{x.coursecode.lower()}-{x.year[2:]}{x.month}{x.day}-{x.desc_slug}'


@csrf.exempt
@scim.route('/Groups', methods=['post'])
@use_args(SCIMGroupSchema(), locations=("json",))
def post_group(args: SCIMGroupModel):
    gname = scim_group_to_tim(args.externalId)
    ug = try_get_group_by_scim(args.externalId)
    if ug:
        msg = f'Group already exists: {gname}'
        log_warning(msg)
        log_warning(str(args))
        raise SCIMException(409, msg)
    deleted_group = UserGroup.get_by_name(f'{DELETED_GROUP_PREFIX}{args.externalId}')
    derived_name = derive_scim_group_name(args.displayName)
    if deleted_group:
        ug = deleted_group
        ug.name = derived_name
    else:
        ug = UserGroup(name=derived_name, display_name=args.displayName)
        db.session.add(ug)
    update_users(ug, args)
    db.session.commit()
    return json_response(group_scim(ug), status_code=201)


@scim.route('/Groups/<group_id>')
def get_group(group_id):
    ug = get_group_by_scim(group_id)
    return json_response(group_scim(ug))


@csrf.exempt
@scim.route('/Groups/<group_id>', methods=['put'])
def put_group(group_id: str):
    ug = get_group_by_scim(group_id)
    d = load_data_from_req(SCIMGroupSchema)
    update_users(ug, d)
    db.session.commit()
    return json_response(group_scim(ug))


@csrf.exempt
@scim.route('/Groups/<group_id>', methods=['delete'])
def delete_group(group_id):
    ug = get_group_by_scim(group_id)
    ug.name = f'{DELETED_GROUP_PREFIX}{ug.external_id.external_id}'
    db.session.delete(ug.external_id)
    db.session.commit()
    return Response(status=204)


@scim.route('/Users/<user_id>')
def get_user(user_id):
    u = User.get_by_name(user_id)
    if not u:
        raise SCIMException(404, 'User not found.')
    return json_response(u.get_scim_data())


@csrf.exempt
@scim.route('/Users/<user_id>', methods=['put'])
def put_user(user_id):
    u = User.get_by_name(user_id)
    if not u:
        raise SCIMException(404, 'User not found.')
    um: SCIMUserModel = load_data_from_req(SCIMUserSchema)
    u.real_name = last_name_to_first(um.displayName)
    if um.emails:
        u.email = um.emails[0].value
    db.session.commit()
    return json_response(u.get_scim_data())


def load_data_from_req(schema):
    ps = schema()
    try:
        j = request.get_json()
        if j is None:
            raise SCIMException(422, 'JSON payload missing.')
        p = ps.load(j)
    except ValidationError as e:
        raise SCIMException(422, json.dumps(e.messages, sort_keys=True))
    return p


def update_users(ug: UserGroup, args: SCIMGroupModel):
    external_id = args.externalId
    if not ug.external_id:
        if not external_id_re.fullmatch(external_id):
            raise SCIMException(422, f'Unexpected externalId format: {external_id}')
        ug.external_id = ScimUserGroup(external_id=external_id)
    else:
        if ug.external_id.external_id != args.externalId:
            raise SCIMException(422, 'externalId unexpectedly changed')
    removed_user_names = set(u.name for u in ug.users) - set(u.value for u in args.members)
    removed_users = User.query.filter(User.name.in_(removed_user_names)).all()
    for u in removed_users:
        if not is_manually_added(u):
            ug.users.remove(u)
    c_name = f'{CUMULATIVE_GROUP_PREFIX}{external_id}'
    cumulative_group = UserGroup.get_by_name(c_name)
    if not parse_sisu_group_display_name(args.displayName):
        raise SCIMException(422, f'Unexpected displayName format: {args.displayName}')
    ug.display_name = args.displayName
    if not cumulative_group:
        cumulative_group = UserGroup.create(c_name)
    emails = [m.email for m in args.members if m.email is not None]
    unique_emails = set(emails)
    if len(emails) != len(unique_emails):
        raise SCIMException(422, f'The users do not have distinct emails.')

    unique_usernames = set(m.value for m in args.members)
    if len(args.members) != len(unique_usernames):
        raise SCIMException(422, f'The users do not have distinct usernames.')

    for u in args.members:
        if u.name:
            expected_name = u.name.derive_full_name(last_name_first=True)
            consistent = (u.display.endswith(' ' + u.name.familyName)
                          # There are some edge cases that prevent this condition from working, so it has been disabled.
                          # and set(expected_name.split(' ')[1:]) == set(u.display.split(' ')[:-1])
                          )
            if not consistent:
                raise SCIMException(
                    422,
                    f"The display attribute '{u.display}' is inconsistent with the name attributes: "
                    f"given='{u.name.givenName}', middle='{u.name.middleName}', family='{u.name.familyName}'.")
            name_to_use = expected_name
        else:
            name_to_use = last_name_to_first(u.display)
        try:
            user = create_or_update_user(
                u.email,
                name_to_use,
                u.value,
                origin=UserOrigin.Sisu,
                group_to_add=ug,
                allow_finding_by_email=False,
            )
        except IntegrityError as e:
            db.session.rollback()
            raise SCIMException(422, e.orig.diag.message_detail) from e
        # This flush basically gets rid of a vague error message about AppenderBaseQuery
        # if an error (UniqueViolation) occurs during a server test (because of an error in test code).
        # It is not strictly necessary.
        db.session.flush()
        if user not in cumulative_group.users:
            cumulative_group.users.append(user)
    refresh_sisu_grouplist_doc(ug)


def is_manually_added(u: User):
    """It is possible to add user manually to SCIM groups.
    For now we assume that any email user is such.
    """
    return u.is_email_user


def group_scim(ug: UserGroup):
    def members():
        for u in ug.users.all():  # type: User
            if not is_manually_added(u):
                yield {
                    'value': u.scim_id,
                    '$ref': u.scim_location,
                    'display': u.scim_display_name,
                }

    return {
        **ug.get_scim_data(),
        'members': list(members()),
    }


def try_get_group_by_scim(group_id: str):
    try:
        ug = ScimUserGroup.query.filter_by(external_id=scim_group_to_tim(group_id)).join(UserGroup).with_entities(
            UserGroup).first()
    except ValueError:
        raise SCIMException(404, f'Group {group_id} not found')
    return ug


def get_group_by_scim(group_id: str):
    ug = try_get_group_by_scim(group_id)
    if not ug:
        raise SCIMException(404, f'Group {group_id} not found')
    return ug
