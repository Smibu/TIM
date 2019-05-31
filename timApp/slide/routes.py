import json

import attr
from flask import request, abort, Blueprint
from marshmallow import Schema, fields, post_load
from webargs.flaskparser import use_args

from timApp.auth.accesshelper import get_doc_or_abort, verify_manage_access
from timApp.slide.slidestatus import SlideStatus
from timApp.timdb.sqa import db
from timApp.util.flask.responsehelper import json_response, ok_response

slide_bp = Blueprint('slide',
                     __name__,
                     url_prefix='')


@slide_bp.route("/getslidestatus")
def getslidestatus():
    if 'doc_id' not in request.args:
        abort(404, "Missing doc id")
    doc_id = int(request.args['doc_id'])
    status: SlideStatus = SlideStatus.query.filter_by(doc_id=doc_id).first()
    if status:
        status = status.status
    return json_response(json.loads(status))


class SetSlideStatusSchema(Schema):
    doc_id = fields.Int(required=True)
    indexf = fields.Int(required=True)
    indexh = fields.Int(required=True)
    indexv = fields.Int(required=True)

    @post_load
    def make_obj(self, data):
        return SetSlideStatusModel(**data)


@attr.s(auto_attribs=True)
class SetSlideStatusModel:
    doc_id: int
    indexf: int
    indexh: int
    indexv: int


@slide_bp.route("/setslidestatus", methods=['post'])
@use_args(SetSlideStatusSchema())
def setslidestatus(args: SetSlideStatusModel):
    doc_id = args.doc_id
    d = get_doc_or_abort(doc_id)
    verify_manage_access(d)
    status = attr.asdict(args)
    status.pop('doc_id')
    s = SlideStatus(doc_id=doc_id, status=json.dumps(status))
    db.session.merge(s)
    db.session.commit()
    return ok_response()
