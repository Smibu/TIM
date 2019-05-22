import json
from typing import List, Tuple, Iterable
import dateutil.relativedelta

from flask import Blueprint, request, abort

from timApp.answer.routes import period_handling
from timApp.auth.sessioninfo import get_current_user_object
from timApp.plugin.plugin import Plugin
from timApp.user.user import User
from timApp.util.flask.responsehelper import csv_response
from timApp.plugin.taskid import TaskId
from datetime import datetime, timezone
from timApp.answer.answer import Answer
from timApp.plugin.pluginControl import task_ids_to_strlist

from timApp.document.docentry import DocEntry, get_documents_in_folder
from timApp.util.flask.requesthelper import get_option
from timApp.util.utils import get_current_time
from timApp.auth.accesshelper import verify_teacher_access
from timApp.plugin.pluginControl import find_task_ids
import csv

feedback = Blueprint('feedback',
                     __name__,
                     url_prefix='/feedback')


def get_all_feedback_answers(task_ids: List[TaskId],
                             hide_names: bool,
                             printname: bool,
                             valid: str,
                             exp_answers: str,
                             users: List[str],
                             period_from: datetime,
                             period_to: datetime,
                             dec: str):
    """
    Get feedback answer results.
    :param task_ids: List of task ids.
    :param hide_names: Parameter for whether to show users anonymously.
    :param printname: Parameter for whether to show full name.
    :param valid: Parameter for validity filter; "0", "1", "all".
    :param exp_answers: Parameter for filtering users.
    :param users: List of visible users with selected user always first.
    :param period_from: The minimum answering time for answers.
    :param period_to: The maximum answering time for answers.
    :param dec: Format for the decimal separator.
    :return: Compiled list of test results.
    """

    # Query from answer-table for the given time period and TaskId:s.
    q = (Answer
         .query
         .filter((period_from <= Answer.answered_on) & (Answer.answered_on < period_to))
         .filter(Answer.task_id.in_(task_ids_to_strlist(task_ids))))
    
    # Checks validity of answers and filters if needed.
    if valid == 'all':
        pass
    elif valid == '0':
        q = q.filter_by(valid=False)
    else:
        q = q.filter_by(valid=True)

    # Also joins with user table to get user information.
    q = q.join(User, Answer.users)

    # Sorts the answers first with user then by time - for a report of whole test result by one user.
    q = q.order_by(User.name, Answer.answered_on)

    # "q" with Answer and User data.
    q = q.with_entities(Answer, User)

    # Makes q query an iterable qq for for-loop.
    qq: Iterable[Tuple[Answer, User]] = q

    return compile_csv(qq, printname, hide_names, exp_answers, users, dec)


def compile_csv(qq: Iterable[Tuple[Answer, User]], printname: bool, hide_names: bool, exp_answers: str, s_user: [str], dec: str):
    """
    Compile data into more csv friendly form.
    :param qq: List of Tuples containing Answers and Users.
    :param printname: Parameter whether to show full name.
    :param hide_names: Parameter whether to show users anonymously.
    :param exp_answers: Parameter for filtering users.
    :param s_user: Visible users with first one always being the selected user.
    :param dec: Format for the decimal separator.
    :return: Returns test results as list.
    """

    pt_dt = None    # Previous Datetime of previous answer.
    prev_ans = None     # Previous Answer.
    prev_user = None     # Previous User.

    results = []

    # Dictionary and counting for anons.
    anons = {}
    cnt = 0

    for answer, user in qq:

        if prev_user != user:   # Resets if previous is different user.
            prev_user = None
            prev_ans = None
            pt_dt = None
            results.append([])

        if prev_user is None:
            prev_user = user
        if prev_ans is None:
            prev_ans = answer

        # Find type of the plugin.

        answer_task_id = answer.task_id
        p = Plugin.from_task_id(answer_task_id, user=get_current_user_object())
        ptype = p.type

        # Boolean to check whether to filter out current user by name.
        is_correct_user_s = False
        if exp_answers == 'selected':
            is_correct_user_s = user.name == s_user[0]
        elif exp_answers == 'visible':
            if user.name in s_user:
                is_correct_user_s = True
        else:
            is_correct_user_s = True

        # If plugin is feedback then record the data into report.
        if ptype == 'feedback' and is_correct_user_s:
            if not (prev_user in anons):
                anons[prev_user] = f"user{cnt}"
                cnt += 1
            anonuser = anons[prev_user]
            json_content = json.loads(answer.content)
            correct = json_content.get('correct')

            # If we need it in right/wrong format.
            if correct:
                answer_result = 'right'
            else:
                answer_result = 'wrong'



            sel_opt_content = json_content.get('user_answer', "<JSON error: key 'user_answer' not found>")
            item_content = json_content.get('correct_answer', "<JSON error: key 'correct_answer' not found>")
            feedback_content = json_content.get('feedback', "<JSON error: key 'feedback' not found>")

            if pt_dt != None:
                tasksecs = (prev_ans.answered_on - pt_dt).total_seconds()   # Get time subtracted by previous.
            else:
                tasksecs = 0.0

            fbsecs = (answer.answered_on - prev_ans.answered_on).total_seconds()

            if (dec == "comma"):
                fbsecs_str = str(round(fbsecs, 1)).replace(".", ",")
                tasksecs_str = str(round(tasksecs, 1)).replace(".", ",")
            else:
                fbsecs_str = str(round(fbsecs, 1))
                tasksecs_str = str(round(tasksecs, 1))

            if hide_names:
                shown_user = anonuser
            else:
                shown_user = prev_user.name

            # IF-CONDITION temporary for the sake of excluding the first sample item.
            if pt_dt and sel_opt_content != "" and feedback_content != "" and item_content != "":
                if printname and not hide_names:
                    results.append([prev_user.real_name,
                                    shown_user,
                                    answer_result,
                                    item_content,
                                    sel_opt_content,
                                    feedback_content,
                                    tasksecs_str,
                                    fbsecs_str])
                else:
                    results.append([shown_user,
                                answer_result,
                                item_content,
                                sel_opt_content,
                                feedback_content,
                                tasksecs_str,
                                fbsecs_str])

        pt_dt = prev_ans.answered_on
        prev_ans = answer
        prev_user = user

    return results


@feedback.route("/report/<path:doc_path>")
def print_feedback_report(doc_path):
    """
    Route to Feedback report.
    :param doc_path: URL for the document.
    :return: report in a CSV-form.
    """

    d = DocEntry.find_by_path(doc_path, fallback_to_id=True)    # Return task from URL.

    all_id = get_documents_in_folder(d.location)    # Finds all doc in the folder.

    verify_teacher_access(d)
    pars = d.document.get_dereferenced_paragraphs()     # Get dereferenced paragraphs from document.
    task_ids, _, access_missing = find_task_ids(pars)                # Find task ids from the derefenced paragraphs.

    if len(access_missing) > 0:
        abort(403, 'Access missing for task_ids: ' + access_missing)

    name = get_option(request, 'name', 'both')
    hidename = False
    fullname = False
    format = get_option(request, 'format', 'excel')
    validity = get_option(request, 'valid', 'all')
    exp_answers = get_option(request, 'answers', 'all')
    users = get_option(request, 'users', 'none')
    scope = get_option(request, 'scope', 'task')
    decimal = get_option(request, 'decimal', 'point')
    list_of_users = users.split(",")

    # Booleans for how to show user names.
    if name == 'anonymous':
        hidename = True
    elif name == 'both':
        fullname = True

    # Dialect names for the csv-writer delimitors.
    if format == 'tab':
        dialect = 'excel-tab'
    elif format == 'comma':
        dialect = 'excel'
    elif format == 'semicolon':
        dialect = csv.excel
        dialect.delimiter = ';'
    elif format == 'bar':
        dialect = csv.excel
        dialect.delimiter = '|'
    else:
        dialect = csv.excel
        dialect == 'semicolon'

    period = get_option(request, 'period', 'whenever')

    # Creates list of document ids from task ids.
    doc_ids = set()
    for tid in task_ids:
        doc_ids.add(tid.doc_id)

    period_from, period_to = period_handling(task_ids, doc_ids, period)

    answers = []

    if fullname and not hidename:
        answers.append(['Full Name',
                        'Username',
                        'Result',
                        'Item',
                        'Selected option',
                        'Feedback', 'Time spent on item(sec)',
                        'Time spent on feedback(sec)'])
    else:
        answers.append(['Username',
                        'Result',
                        'Item',
                        'Selected option',
                        'Feedback',
                        'Time spent on item(sec)',
                        'Time spent on feedback(sec)'])

    # Get answers for the task ids with the proper parameters.

    if scope == 'task':
        answers += get_all_feedback_answers(task_ids,
                                            hidename,
                                            fullname,
                                            validity,
                                            exp_answers,
                                            list_of_users,
                                            period_from,
                                            period_to,
                                            decimal)
    elif scope == 'test':
        all_tasks = []
        for did in all_id:
            did_pars = did.document.get_dereferenced_paragraphs()
            task_dids, _ , access_missing2 = find_task_ids(did_pars)
            if len(access_missing2) > 0:
                abort(403, 'Access missing for task_ids: ' + access_missing2)
            all_tasks += task_dids
        answers += get_all_feedback_answers(all_tasks,
                                                hidename,
                                                fullname,
                                                validity,
                                                exp_answers,
                                                list_of_users,
                                                period_from,
                                                period_to,
                                                decimal)
    return csv_response(answers, dialect)

