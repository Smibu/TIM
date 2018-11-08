import itertools

from flask import Request, current_app, request
from flask import request, abort
from typing import Optional
from werkzeug.wrappers import BaseRequest

from timApp.timdb.exceptions import InvalidReferenceException
from timApp.user.user import Consent


def verify_json_params(*args: str, require=True, default=None, error_msgs=None):
    """Gets the specified JSON parameters from the request.

    :param default: The default value for the parameter if it is not found from the request.
    :param require: If True and the parameter is not found, the request is aborted.
    """
    result = ()
    json_params = request.get_json() or {}
    if error_msgs is not None:
        assert len(args) == len(error_msgs)
    for arg, err in zip(args, error_msgs or itertools.repeat(None, len(args))):
        if arg in json_params:
            val = json_params[arg]
        elif not require:
            val = default
        else:
            abort(400, err or f'Missing required parameter in request: {arg}')
            return ()

        result += (val,)
    return result


def unpack_args(*args, types):
    result = ()
    json_params = request.args
    for idx, arg in enumerate(args):
        if arg not in json_params:
            abort(400, f'Missing required parameter in request: {arg}')
        result += types[idx](json_params[arg]),
    return result


def get_referenced_pars_from_req(par):
    if par.is_reference() and not par.is_translation():
        try:
            return [ref_par for ref_par in par.get_referenced_pars(set_html=False)]
        except InvalidReferenceException as e:
            abort(404, str(e))
    else:
        return [par]


def get_option(req: Request, name: str, default, cast=None):
    if name not in req.args:
        return default
    result = req.args[name]
    lresult = result.lower()
    if isinstance(default, bool):
        if len(lresult) == 0:
            return default
        if "f0".find(lresult[0]) >= 0:
            return False
        if "t1".find(lresult[0]) >= 0:
            return True
        return True
    if isinstance(default, int):
        try:
            return int(lresult)
        except ValueError:
            return default
    if cast is not None:
        try:
            result = cast(result)
        except ValueError:
            return default
    return result


def is_xhr(req: BaseRequest):
    """Same as req.is_xhr but without the deprecation warning."""
    return req.environ.get(
        'HTTP_X_REQUESTED_WITH', ''
    ).lower() == 'xmlhttprequest'


def is_testing():
    return current_app.config['TESTING']


def is_localhost():
    return current_app.config['TIM_HOST'] in ('http://localhost', 'http://nginx')


def get_consent_opt() -> Optional[Consent]:
    consent_opt = get_option(request, 'consent', 'any')
    if consent_opt == 'true':
        consent = Consent.CookieAndData
    elif consent_opt == 'false':
        consent = Consent.CookieOnly
    elif consent_opt == 'any':
        consent = None
    else:
        return abort(400, 'Invalid consent option. Must be "true", "false" or "any".')
    return consent
