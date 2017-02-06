import http.client
import os
import socket
from typing import Optional

from flask import Blueprint
from flask import request

from accesshelper import verify_logged_in
from dbaccess import get_timdb
from decorators import async
from logger import log_info, log_error
from responsehelper import json_response, ok_response
from sessioninfo import get_current_user, get_current_user_id, get_current_user_name
from tim_app import app
from timdb.models.docentry import DocEntry

FUNNEL_HOST = "funnel"
FUNNEL_PORT = 80

notify = Blueprint('notify',
                   __name__,
                   url_prefix='')


@notify.route('/notify/<int:doc_id>', methods=['GET'])
def get_notify_settings(doc_id):
    verify_logged_in()
    timdb = get_timdb()
    settings = timdb.documents.get_notify_settings(get_current_user_id(), doc_id)
    return json_response(settings)


@notify.route('/notify/<int:doc_id>', methods=['POST'])
def set_notify_settings(doc_id):
    verify_logged_in()
    jsondata = request.get_json()
    timdb = get_timdb()
    timdb.documents.set_notify_settings(get_current_user_id(), doc_id, jsondata)
    return ok_response()


@async
def send_email(rcpt: str, subject: str, msg: str, mail_from: Optional[str] = None, reply_to: Optional[str] = None,
               group_id: Optional[str] = None, group_subject: Optional[str] = None):
    with app.app_context():
        conn = None
        try:
            headers = {
                "Host": "tim",
                "Accept-Encoding": "text/plain",
                "Encoding": "text/html",
                "Connection": "close",
                "Subject": subject,
                "Rcpt-To": rcpt}

            if mail_from:
                headers['From'] = mail_from
            if reply_to:
                headers['Reply-To'] = reply_to
            if group_id and group_subject:
                headers['Group-Id'] = group_id
                headers['Group-Subject'] = group_subject

            conn = http.client.HTTPConnection(FUNNEL_HOST, port=FUNNEL_PORT)
            conn.request("POST", "/mail", body=msg.replace('\n', '<br>').encode('utf-8'), headers=headers)
            log_info("Sending email to " + rcpt)

            response = conn.getresponse()
            if response.status != 200:
                log_error('Response from funnel: {} {}'.format(response.status, response.reason))

        except (ConnectionError, socket.error, http.client.error) as e:
            log_error("Couldn't connect to funnel: {} - {}".format(e, msg))

        finally:
            if conn is not None:
                conn.close()


def replace_macros(msg: str, doc_id: int, par_id: Optional[str]) -> str:
    new_msg = msg
    if '[user_name]' in msg:
        new_msg = new_msg.replace('[user_name]', get_current_user_name())
    if '[doc_name]' in msg or '[doc_url]' in msg:
        doc_name = DocEntry.find_by_id(doc_id, try_translation=True).path
        par_part = '' if par_id is None else '#' + par_id
        doc_url = '{}/view/{}{}'.format(os.environ.get("TIM_HOST", "http://localhost"), doc_name.replace(' ', '%20'),
                                        par_part)
        new_msg = new_msg.replace('[doc_name]', doc_name).replace('[doc_url]', doc_url)
    if '[doc_id]' in msg:
        new_msg = new_msg.replace('[doc_id]', str(doc_id))
    if '[base_url]' in msg:
        new_msg = new_msg.replace('[base_url]', os.environ.get("TIM_HOST", "http://localhost"))

    return new_msg


def notify_doc_owner(doc_id, subject, msg, setting=None, par_id=None, group_id=None, group_subject=None):
    timdb = get_timdb()
    me = get_current_user()
    owner_group = timdb.documents.get_owner(doc_id)
    macro_subject = replace_macros(subject, doc_id, par_id)
    macro_msg = replace_macros(msg, doc_id, par_id)

    macro_grpid = replace_macros(group_id, doc_id, par_id) if group_id else None
    macro_grpsubj = replace_macros(group_subject, doc_id, par_id) if group_subject else None

    for user in timdb.users.get_users_in_group(owner_group):
        if user['id'] != me['id'] and user['email']:
            if setting is not None:
                settings = timdb.documents.get_notify_settings(user['id'], doc_id)
                if not settings['email_' + setting]:
                    continue

            send_email(user['email'], macro_subject, macro_msg, mail_from=me['email'],
                       group_id=macro_grpid, group_subject=macro_grpsubj)
