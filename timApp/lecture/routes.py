import json
import threading
import time
from datetime import timezone, datetime, timedelta
from random import randrange
from typing import List, Optional

import dateutil.parser
from flask import Blueprint, render_template
from flask import Response
from flask import abort
from flask import current_app
from flask import request
from flask import session

from timApp.auth.accesshelper import verify_ownership, get_doc_or_abort
from timApp.document.post_process import has_ownership
from timApp.document.randutils import hashfunc
from timApp.util.flask.requesthelper import get_option, verify_json_params
from timApp.util.flask.responsehelper import json_response, ok_response, empty_response, json_response_and_commit
from timApp.auth.login import log_in_as_anonymous
from timApp.plugin.qst.qst import get_question_data_from_document, create_points_table, \
    calculate_points_from_json_answer, calculate_points
from timApp.auth.sessioninfo import get_current_user_id, logged_in, get_current_user_name, get_current_user_object, \
    current_user_in_lecture, get_user_settings
from timApp.tim_app import app
from timApp.lecture.askedjson import get_asked_json_by_hash, AskedJson
from timApp.lecture.askedquestion import AskedQuestion, get_asked_question
from timApp.document.docentry import DocEntry
from timApp.lecture.lecture import Lecture
from timApp.lecture.lectureanswer import LectureAnswer, get_totals
from timApp.lecture.message import Message
from timApp.user.user import User
from timApp.lecture.runningquestion import Runningquestion
from timApp.lecture.questionactivity import QuestionActivityKind, QuestionActivity
from timApp.lecture.showpoints import Showpoints
from timApp.lecture.useractivity import Useractivity
from timApp.timdb.sqa import db
from timApp.lecture.question import Question

lecture_routes = Blueprint('lecture',
                           __name__,
                           url_prefix='')


def is_lecturer_of(l: Lecture):
    return l.lecturer == get_current_user_id()


def verify_is_lecturer(l: Lecture):
    if not is_lecturer_of(l):
        abort(400, 'Only lecturer can perform this action.')


@lecture_routes.route('/getLectureInfo')
def get_lecture_info():
    """Route to get info from lectures.

    Gives answers, and messages and other necessary info.

    """
    lecture = get_lecture_from_request(check_access=False)
    messages = lecture.messages.order_by(Message.timestamp.asc()).all()
    is_lecturer = is_lecturer_of(lecture)
    current_user = get_current_user_id()
    lecture_questions: List[AskedQuestion] = lecture.asked_questions.all()

    if is_lecturer:
        answers = [a for q in lecture_questions for a in q.answers.all()]
        answerers = list({a.user for a in answers})
    else:
        answers = [a for q in lecture_questions for a in q.answers.filter_by(user_id=current_user)]
        answerers = [get_current_user_object()]

    return json_response(
        {
            "answerers": answerers,
            "answers": answers,
            "isLecturer": is_lecturer,
            "messages": messages,
            "questions": lecture_questions,
        })


@lecture_routes.route('/getLectureAnswerTotals/<int:lecture_id>')
def get_lecture_answer_totals(lecture_id):
    is_lecturer = is_lecturer_of(Lecture.find_by_id(lecture_id))
    results = get_totals(lecture_id, None if is_lecturer else get_current_user_id())
    sum_field_name = get_option(request, 'sum_field_name', 'sum')
    count_field_name = get_option(request, 'count_field_name', 'count')

    def generate_text():
        for a in results:
            yield f'{a["name"]};{sum_field_name};{a["sum"]}\n'
        yield '\n'
        for a in results:
            yield f'{a["name"]};{count_field_name};{a["count"]}\n'
    return Response(generate_text(), mimetype='text/plain')


@lecture_routes.route('/getAllMessages')
def get_all_messages():
    """Route to get all the messages from some lecture.
    """
    lecture = get_lecture_from_request(check_access=False)
    messages = lecture.messages.order_by(Message.timestamp.asc()).all()
    return json_response(messages)


@lecture_routes.route('/getUpdates')
def get_updates():
    # taketime("before update")
    ret = do_get_updates(request)
    # taketime("after update")
    return ret


EXTRA_FIELD_NAME = "extra"


def do_get_updates(request):
    """Gets updates from some lecture.

    Checks updates in 1 second frequently and answers if there is updates.

    """
    if not request.args.get('c'):
        abort(400, "Bad request")
    client_last_id = int(request.args.get('c'))  # client_message_id'))
    current_question_id = None
    current_points_id = None
    if 'i' in request.args:
        current_question_id = int(request.args.get('i'))  # current_question_id'))
    if 'p' in request.args:
        current_points_id = int(request.args.get('p'))  # current_points_id'))

    use_wall = get_option(request, 'm', False)  # 'get_messages'
    session['use_wall'] = use_wall
    use_questions = get_option(request, 'q', False)  # 'get_questions'
    session['use_questions'] = use_questions

    step = 0
    lecture = get_current_lecture()

    doc_id = request.args.get("d")  # "doc_id"
    if doc_id:
        doc_id = int(doc_id)
    if not lecture:
        return get_running_lectures(doc_id)
    lecture_id = lecture.lecture_id
    if not lecture.is_running:
        empty_lecture(lecture)
        db.session.commit()
        return get_running_lectures(doc_id)

    list_of_new_messages = []

    lecturers = []
    students = []
    user_name = get_current_user_name()

    update_activity(lecture, get_current_user_object())

    options = lecture.options_parsed
    teacher_poll = options.get("teacher_poll", "")
    teacher_poll = teacher_poll.split(";")
    poll_interval_ms = 4000
    long_poll = False
    # noinspection PyBroadException
    try:
        poll_interval_ms = int(options.get("poll_interval", 4))*1000
        long_poll = bool(options.get("long_poll", False))
    except:
        pass

    # noinspection PyBroadException
    try:
        poll_interval_t_ms = int(options.get("poll_interval_t", 1))*1000
        long_poll_t = bool(options.get("long_poll_t", False))
    except:
        pass

    poll_interval_ms += randrange(-100, 500)

    if teacher_poll:
        # noinspection PyBroadException
        try:
            if teacher_poll.index(user_name) >= 0:
                poll_interval_ms = poll_interval_t_ms
                long_poll = long_poll_t
        except:
            pass

    is_lecturer = is_lecturer_of(lecture)

    lecture_ending = 100
    base_resp = None
    u = get_current_user_object()
    # Jos poistaa tämän while loopin, muuttuu long pollista perinteiseksi polliksi
    while step <= 10:
        lecture_ending = check_if_lecture_is_ending(lecture)
        if is_lecturer:
            lecturers, students = get_lecture_users(lecture)
            poll_interval_ms = poll_interval_t_ms
            long_poll = long_poll_t
        # Gets new messages if the wall is in use.
        if use_wall:
            list_of_new_messages = lecture.messages.filter(Message.msg_id > client_last_id).order_by(
                Message.msg_id.asc()).all()

        base_resp = {
            "msgs": list_of_new_messages,
            "lectureEnding": lecture_ending,
            "lectureId": lecture_id,
            "lecturers": lecturers,
            "ms": poll_interval_ms,
            "students": students,
        }

        # Check if current question is still running and user hasn't already answered on it on another tab
        # Return also questions new end time if it is extended

        if current_question_id:
            resp = {
                **base_resp,
                EXTRA_FIELD_NAME: {
                    "new_end_time": None,
                }
            }

            q = get_asked_question(current_question_id)
            already_answered = None
            if q and q.running_question:
                already_answered = q.has_activity(QuestionActivityKind.Useranswered, u)
            if q and q.running_question and not already_answered:
                already_extended = q.has_activity(QuestionActivityKind.Userextended, u)
                if not already_extended:
                    q.add_activity(QuestionActivityKind.Userextended, u)
                    # Return this is question has been extended
                    resp[EXTRA_FIELD_NAME]['new_end_time'] = q.running_question.end_time
                    return json_response_and_commit(resp)
            else:
                # Return this if question has ended or user has answered to it
                return json_response_and_commit(resp)

        if current_points_id:
            resp = {
                **base_resp,
                EXTRA_FIELD_NAME: {
                    "points_closed": True,
                }
            }
            q = get_asked_question(current_points_id)
            already_closed = False
            if q:
                already_closed = q.has_activity(QuestionActivityKind.Pointsclosed, u)
            if already_closed:
                return json_response_and_commit(resp)

        # Gets new questions if the questions are in use.
        if use_questions:
            new_question = get_new_question(lecture, current_question_id, current_points_id)
            if new_question:
                return json_response_and_commit({**base_resp, EXTRA_FIELD_NAME: new_question})

        if list_of_new_messages:
            return json_response_and_commit(base_resp)

        if not long_poll or current_app.config['TESTING']:
            # Don't loop when testing
            break
        # For long poll wait 1 sek before new check.
        time.sleep(1)
        step += 1

    if lecture_ending != 100 or lecturers or students:
        return json_response_and_commit(base_resp)

    return json_response_and_commit({"ms": poll_interval_ms})  # no new updates


@lecture_routes.route('/getQuestionManually')
def get_question_manually():
    """Route to use to get question manually (instead of getting question in /getUpdates)."""
    lecture = get_current_lecture_or_abort()
    new_question = get_new_question(lecture, None, None, True)
    return json_response(new_question)


def get_new_question(lecture: Lecture, current_question_id=None, current_points_id=None, force=False):
    """
    :param current_points_id: TODO: what is this?
    :param current_question_id: The id of the current question.
    :param lecture: lecture to get running questions from
    :param force: Return question, even if it already has been shown to user
    :return: None if no questions are running
             dict with data of new question if there is a question running and user hasn't answered to that question.
             {'type': 'already_answered'} if there is a question running and user has answered to that.
    """
    current_user = get_current_user_id()
    u = get_current_user_object()
    question = lecture.running_questions
    if question:
        question: AskedQuestion = question[0].asked_question
        asked_id = question.asked_id
        already_shown = question.has_activity(QuestionActivityKind.Usershown, u)
        already_answered = question.has_activity(QuestionActivityKind.Useranswered, u)
        if already_answered:
            if force:
                return {'type': 'already_answered'}
            else:
                return None
        if (not already_shown or force) or (asked_id != current_question_id):
            q = get_asked_question(asked_id)
            answer = q.answers.filter_by(user_id=current_user).first()
            question.add_activity(QuestionActivityKind.Usershown, u)
            question.add_activity(QuestionActivityKind.Userextended, u)
            return {'type': 'answer', 'data': answer} if answer else {'type': 'question', 'data': q}
    else:
        question_to_show_points = get_shown_points(lecture)
        if question_to_show_points:
            asked_id = question_to_show_points.asked_id
            already_shown = question_to_show_points.has_activity(QuestionActivityKind.Pointsshown, u)
            already_closed = question_to_show_points.has_activity(QuestionActivityKind.Pointsclosed, u)
            if already_closed:
                if force:
                    db.session.delete(already_closed)
                else:
                    return None
            if not (already_shown or force) or (asked_id != current_points_id):
                question = get_asked_question(asked_id)
                question.add_activity(QuestionActivityKind.Pointsshown, u)
                answer = question.answers.filter_by(user_id=current_user).first()
                if answer:
                    return {'type': 'result', 'data': answer}
        return None


def get_shown_points(lecture) -> Optional[AskedQuestion]:
    return lecture.asked_questions.join(Showpoints).first()


def check_if_lecture_is_ending(lecture: Lecture):
    """Checks if the lecture is about to end. 1 -> ends in 1 min. 5 -> ends in 5 min. 100 -> goes on atleast for 5 mins.

    :param lecture: The lecture object.
    :return:

    """
    lecture_ending = 100
    if is_lecturer_of(lecture):
        time_now = datetime.now(timezone.utc)
        ending_time = lecture.end_time
        time_left = ending_time - time_now
        if time_left.total_seconds() <= 60:
            return 1
        elif time_left.total_seconds() <= 60 * 5:
            return 5
    return lecture_ending


@lecture_routes.route('/sendMessage', methods=['POST'])
def send_message():
    """Route to add message to database."""
    new_message = request.args.get("message")
    lecture = get_current_lecture_or_abort()
    msg = Message(message=new_message, user_id=get_current_user_id())
    lecture.messages.append(msg)
    db.session.commit()
    return json_response(msg)


def get_lecture_session_data():
    for k in ('use_wall', 'use_questions'):
        if session.get(k) is None:
            session[k] = True
    return {
        'useWall': session['use_wall'],
        'useQuestions': session['use_questions'],
    }


def lecture_dict(lecture: Lecture):
    is_lecturer = is_lecturer_of(lecture)
    lecturers, students = get_lecture_users(lecture) if is_lecturer else ([], [])
    return {
        "lecture": lecture,
        "isInLecture": current_user_in_lecture(),
        "isLecturer": is_lecturer,
        "lecturers": lecturers,
        "students": students,
        **get_lecture_session_data(),
    }


@lecture_routes.route('/checkLecture', methods=['GET'])
def check_lecture():
    """Route to check if the current user is in some lecture in specific document."""
    lectures = get_current_user_object().lectures.all()
    lecture = lectures[0] if lectures else None

    if lecture:
        if lecture.is_running:
            return json_response(lecture_dict(lecture))
        else:
            leave_lecture_function(lecture)
            empty_lecture(lecture)
            db.session.commit()
    doc_id = request.args.get('doc_id')
    if doc_id is not None:
        return get_running_lectures(int(doc_id))
    else:
        return empty_response()


@lecture_routes.route("/startFutureLecture", methods=['POST'])
def start_future_lecture():
    lecture = get_lecture_from_request(check_access=True)
    time_now = datetime.now(timezone.utc)
    lecture.start_time = time_now
    lecture.users.append(get_current_user_object())
    db.session.commit()
    return json_response(lecture_dict(lecture))


@lecture_routes.route('/getAllLecturesFromDocument', methods=['GET'])
def get_all_lectures():
    if not request.args.get('doc_id'):
        abort(400)

    doc_id = int(request.args.get('doc_id'))

    lectures = Lecture.get_all_in_document(doc_id)
    time_now = datetime.now(timezone.utc)
    current_lectures = []
    past_lectures = []
    future_lectures = []
    for lecture in lectures:
        if lecture.start_time <= time_now < lecture.end_time:
            current_lectures.append(lecture)
        elif lecture.end_time <= time_now:
            past_lectures.append(lecture)
        else:
            future_lectures.append(lecture)

    return json_response(
        {"currentLectures": current_lectures, "futureLectures": future_lectures, "pastLectures": past_lectures})


@lecture_routes.route('/showLectureInfo/<int:lecture_id>', methods=['GET'])
def show_lecture_info(lecture_id):
    lecture = Lecture.find_by_id(lecture_id)
    if not lecture:
        abort(400, 'Lecture not found')

    doc = DocEntry.find_by_id(lecture.doc_id)
    lectures = get_current_user_object().lectures.all()
    settings = get_user_settings()
    return render_template("lectureInfo.html",
                           item=doc,
                           lecture=lecture,
                           in_lecture=len(lectures) > 0,
                           settings=settings,
                           translations=doc.translations)


@lecture_routes.route('/showLectureInfoGivenName')
def show_lecture_info_given_name():
    lecture = get_lecture_from_request(check_access=False)
    return json_response(lecture.to_json(show_password=is_lecturer_of(lecture)))


@lecture_routes.route('/getLectureByCode')
def lecture_needs_password():
    lecture = get_lecture_from_request(check_access=False)
    return json_response(lecture)


def get_lecture_users(lecture: Lecture):
    lecturers = []
    students = []

    activity = Useractivity.query.filter_by(lecture=lecture).all()

    for ac in activity:
        user_id = ac.user_id
        active = ac.active
        person = {
            "user": ac.user,
            "active": active,
        }
        if lecture.lecturer == user_id:
            lecturers.append(person)
        else:
            students.append(person)

    return lecturers, students


def get_running_lectures(doc_id=None):
    """Gets all running and future lectures.

    :param doc_id: The document id for which to get lectures.

    """
    time_now = datetime.now(timezone.utc)
    list_of_lectures = []
    is_lecturer = False
    if doc_id:
        list_of_lectures = Lecture.get_all_in_document(doc_id, time_now)
        d = get_doc_or_abort(doc_id)
        is_lecturer = bool(has_ownership(d))
    current_lectures = []
    future_lectures = []
    for lecture in list_of_lectures:
        if lecture.start_time <= time_now < lecture.end_time:
            current_lectures.append(lecture)
        else:
            future_lectures.append(lecture)
    return json_response(
        {
            "isLecturer": is_lecturer,
            "lectures": current_lectures,
            "futureLectures": future_lectures,
        })


@lecture_routes.route('/createLecture', methods=['POST'])
def create_lecture():
    doc_id, start_time, end_time, lecture_code = verify_json_params('doc_id', 'start_time', 'end_time', 'lecture_code')
    start_time = dateutil.parser.parse(start_time)
    end_time = dateutil.parser.parse(end_time)
    lecture_id, password, options = verify_json_params('lecture_id', 'password', 'options', require=False)
    d = get_doc_or_abort(doc_id)
    verify_ownership(d)

    if not options:
        options = {}

    if not password:
        password = ""
    current_user = get_current_user_id()
    lec = Lecture.find_by_code(lecture_code, doc_id)
    if lec and not lecture_id:
        abort(400, "Can't create two or more lectures with the same name to the same document.")

    options = json.dumps(options)
    if lecture_id is None:
        lecture = Lecture(doc_id=doc_id, lecturer=current_user)
        db.session.add(lecture)
    else:
        lecture = Lecture.find_by_id(lecture_id)
        if not lecture:
            return abort(404)
    lecture.start_time = start_time
    lecture.end_time = end_time
    lecture.password = password
    lecture.lecture_code = lecture_code
    lecture.options = options

    current_time = datetime.now(timezone.utc)

    if start_time <= current_time <= end_time:
        lecture.users.append(get_current_user_object())
    db.session.commit()
    return json_response(lecture)


def empty_lecture(lec: Lecture):
    lec.users = []
    clean_dictionaries_by_lecture(lec)


@lecture_routes.route('/endLecture', methods=['POST'])
def end_lecture():
    lecture = get_lecture_from_request()
    now = datetime.now(timezone.utc)
    lecture.end_time = now
    empty_lecture(lecture)
    db.session.commit()
    return get_running_lectures(lecture.doc_id)


def clean_dictionaries_by_lecture(lecture: Lecture):
    """Cleans data from lecture that isn't running anymore.

    :param lecture: The lecture.

    """
    for q in lecture.running_questions:
        db.session.delete(q)
    stop_showing_points(lecture)
    for a in lecture.useractivity:
        db.session.delete(a)
    QuestionActivity.query.filter((QuestionActivity.asked_id.in_(
        AskedQuestion.query.filter_by(lecture_id=lecture.lecture_id).with_entities(AskedQuestion.asked_id))) &
                                  QuestionActivity.kind.in_([QuestionActivityKind.Usershown,
                                                             QuestionActivityKind.Userextended,
                                                             QuestionActivityKind.Pointsshown,
                                                             QuestionActivityKind.Pointsclosed,
                                                             QuestionActivityKind.Useranswered])).delete(synchronize_session='fetch')


def delete_question_temp_data(question: AskedQuestion, lecture: Lecture):
    delete_activity(question, [QuestionActivityKind.Usershown,
                               QuestionActivityKind.Userextended,
                               QuestionActivityKind.Useranswered,
                               QuestionActivityKind.Pointsclosed,
                               QuestionActivityKind.Pointsshown])
    lecture.running_questions = []
    stop_showing_points(lecture)


@lecture_routes.route('/extendLecture', methods=['POST'])
def extend_lecture():
    new_end_time = request.args.get("new_end_time")
    if not new_end_time:
        abort(400)
    lecture = get_lecture_from_request()
    lecture.end_time = new_end_time
    db.session.commit()
    return ok_response()


@lecture_routes.route('/deleteLecture', methods=['POST'])
def delete_lecture():
    lecture = get_lecture_from_request()
    with db.session.no_autoflush:
        empty_lecture(lecture)
        Message.query.filter_by(lecture_id=lecture.lecture_id).delete()
        LectureAnswer.query.filter_by(lecture_id=lecture.lecture_id).delete()
        AskedQuestion.query.filter_by(lecture_id=lecture.lecture_id).delete()
        db.session.delete(lecture)
    db.session.commit()

    return get_running_lectures(lecture.doc_id)


def get_lecture_from_request(check_access=True) -> Lecture:
    lecture_id = get_option(request, 'lecture_id', None, cast=int)
    if not lecture_id:
        lecture_code = get_option(request, 'lecture_code', None)
        doc_id = get_option(request, 'doc_id', None)
        lecture = Lecture.find_by_code(lecture_code, doc_id)
    else:
        lecture = Lecture.find_by_id(lecture_id)
    if not lecture:
        abort(404, 'Lecture not found')
    if check_access:
        d = get_doc_or_abort(lecture.doc_id)
        verify_ownership(d)
    return lecture


@lecture_routes.route('/joinLecture', methods=['POST'])
def join_lecture():
    """Route to join lecture.

    Checks that the given password is correct.

    """
    lecture = get_lecture_from_request(check_access=False)
    password_quess = request.args.get("password_quess")
    lecture_id = lecture.lecture_id

    lecture_ended = not lecture.is_running

    # TODO Allow lecturer always join, even if the lecture is full
    lecture_full = lecture.is_full

    correct_password = True
    if lecture.password != password_quess:
        correct_password = False

    u = get_current_user_object()
    lectures = u.lectures.all()
    if not lecture_ended and not lecture_full and correct_password:
        if not logged_in():
            log_in_as_anonymous(session)  # TODO check this if g.user should be reset
        if lectures:
            leave_lecture_function(lectures[0])
        lecture.users.append(u)

        update_activity(lecture, u)

        session['in_lecture'] = [lecture_id]
        db.session.commit()

    return json_response(
        {
            "correctPassword": correct_password,
            **lecture_dict(lecture),
        })


def update_activity(lecture: Lecture, u: User):
    ua = Useractivity(user_id=u.id, lecture_id=lecture.lecture_id)
    db.session.merge(ua)


@lecture_routes.route('/leaveLecture', methods=['POST'])
def leave_lecture():
    lecture = get_lecture_from_request(check_access=False)
    leave_lecture_function(lecture)
    db.session.commit()
    return ok_response()


def leave_lecture_function(lecture: Lecture):
    lecture_id = lecture.lecture_id
    if 'in_lecture' in session:
        lecture_list = session['in_lecture']
        if lecture_id in lecture_list:
            lecture_list.remove(lecture_id)
        session['in_lecture'] = lecture_list
    u = get_current_user_object()
    if u in lecture.users:
        lecture.users.remove(u)


@lecture_routes.route("/extendQuestion", methods=['POST'])
def extend_question():
    asked_id = int(request.args.get('asked_id'))
    extend = int(request.args.get('extend'))
    q = get_asked_question(asked_id)
    if not q:
        return abort(404)
    rq: Runningquestion = q.running_question
    if not rq:
        abort(400, 'Question is not running')
    rq.end_time += timedelta(seconds=extend)
    delete_activity(q, [QuestionActivityKind.Userextended])
    db.session.commit()
    return ok_response()


def get_current_lecture() -> Optional[Lecture]:
    u = get_current_user_object()
    lectures: List[Lecture] = u.lectures.all()
    if not lectures:
        return None
    if len(lectures) > 1:
        raise Exception(f'User {u.name} has joined to multiple lectures which should not be possible.')
    return lectures[0]


def get_current_lecture_or_abort() -> Lecture:
    lec = get_current_lecture()
    if not lec:
        return abort(400, 'Not joined to any lecture')
    return lec


@lecture_routes.route("/askQuestion", methods=['POST'])
def ask_question():
    if not (request.args.get('question_id') or request.args.get('asked_id') or request.args.get('par_id')):
        abort(400, "Bad request")
    question_id = None
    asked_id = None
    par_id = None
    if request.args.get('question_id'):
        question_id = int(request.args.get('question_id'))
    elif request.args.get('asked_id'):
        asked_id = int(request.args.get('asked_id'))
    else:
        par_id = request.args.get('par_id')

    lecture = get_current_lecture_or_abort()
    verify_is_lecturer(lecture)

    if question_id or par_id:
        doc_id = get_option(request, 'doc_id', None, cast=int)
        if not doc_id:
            abort(400, 'doc_id missing')
        if question_id:
            question = Question.query.get(question_id)  # Old version???
            question_json_str = question.questionjson
            markup = json.loads(question_json_str)
        else:
            d = get_doc_or_abort(doc_id)
            markup = get_question_data_from_document(d, par_id)
            question_json_str = json.dumps(markup.markup)
        question_hash = hashfunc(question_json_str)
        asked_json = get_asked_json_by_hash(question_hash)
        if not asked_json:
            asked_json = AskedJson(json=question_json_str, hash=question_hash)
        asked_time = datetime.now(timezone.utc)

        # Set points and expl as None because they're already contained in the JSON.
        # Only if /updatePoints is called, they are set.
        question = AskedQuestion(lecture=lecture, doc_id=doc_id, asked_time=asked_time, points=None, expl=None,
                                 asked_json=asked_json, par_id=par_id)
        db.session.add(question)
    elif asked_id:
        question = get_asked_question(asked_id)
        if not question:
            abort(404, 'Asked question not found.')
        question.asked_time = datetime.now(timezone.utc)
        lecture = question.lecture
    else:
        return abort(400, 'Missing parameters')

    delete_question_temp_data(question, lecture)
    rq = Runningquestion(lecture=lecture, asked_question=question, ask_time=question.asked_time, end_time=question.end_time)
    db.session.add(rq)
    db.session.commit()
    if question.time_limit:
        thread_to_stop_question = threading.Thread(target=stop_question_from_running,
                                                   args=(question,))
        thread_to_stop_question.start()
    return json_response(question)


@lecture_routes.route('/showAnswerPoints', methods=['POST'])
def show_points():
    if 'asked_id' not in request.args:
        abort(400)
    lecture = get_current_lecture_or_abort()
    verify_is_lecturer(lecture)
    asked_id = int(request.args.get('asked_id'))
    q = get_asked_question(asked_id)
    if not q:
        return abort(404)

    stop_showing_points(lecture)
    sp = Showpoints(asked_question=q)
    db.session.add(sp)

    current_question_id = None
    current_points_id = None
    if 'current_question_id' in request.args:
        current_question_id = int(request.args.get('current_question_id'))
    if 'current_points_id' in request.args:
        current_points_id = int(request.args.get('current_points_id'))
    new_question = get_new_question(lecture, current_question_id, current_points_id)
    db.session.commit()
    if new_question is not None:
        return json_response(new_question)
    return empty_response()


def stop_showing_points(lecture: Lecture):
    Showpoints.query.filter(Showpoints.asked_id.in_(
        AskedQuestion.query.filter_by(lecture_id=lecture.lecture_id).with_entities(AskedQuestion.asked_id))).delete(synchronize_session='fetch')


@lecture_routes.route('/updatePoints/', methods=['POST'])
def update_question_points():
    """Route to get add question to database."""
    if 'asked_id' not in request.args or 'points' not in request.args:
        abort(400)
    asked_id = int(request.args.get('asked_id'))
    points = request.args.get('points')
    expl = request.args.get('expl')
    asked_question = get_asked_question(asked_id)
    verify_is_lecturer(asked_question.lecture)
    asked_question.points = points
    asked_question.expl = expl
    points_table = create_points_table(points)
    question_answers: List[LectureAnswer] = asked_question.answers.all()
    for answer in question_answers:
        answer.points = calculate_points(answer.answer, points_table)
    db.session.commit()
    return ok_response()


def stop_question_from_running(question: AskedQuestion):
    end_time = question.end_time
    qid = question.asked_id
    # Adding extra time to limit so when people gets question a bit later than others they still get to answer
    extra_time = timedelta(seconds=3 if not app.config['TESTING'] else 0)
    end_time += extra_time
    while datetime.now(tz=timezone.utc) < end_time:
        question = AskedQuestion.query.get(qid)
        if not question:
            return
        db.session.refresh(question)
        rq = question.running_question
        if rq:
            end_time = extra_time + rq.end_time
        else:
            return
        time.sleep(1)
    Runningquestion.query.filter_by(asked_id=qid).delete()
    delete_activity(question, [QuestionActivityKind.Usershown,
                               QuestionActivityKind.Userextended,
                               QuestionActivityKind.Useranswered])
    db.session.commit()


def delete_activity(question: AskedQuestion, kinds):
    QuestionActivity.query.filter((QuestionActivity.asked_id == question.asked_id) &
                                  QuestionActivity.kind.in_(kinds)).delete(synchronize_session='fetch')


@lecture_routes.route("/getQuestionByParId", methods=['GET'])
def get_question_by_par_id():
    if not request.args.get("par_id") or not request.args.get("doc_id"):
        abort(400)
    doc_id = int(request.args.get('doc_id'))
    par_id = request.args.get('par_id')
    edit = request.args.get('edit', False)
    d = get_doc_or_abort(doc_id)
    verify_ownership(d)
    question = get_question_data_from_document(d, par_id, edit)
    return json_response(question._asdict())


@lecture_routes.route("/getAskedQuestionById", methods=['GET'])
def get_asked_question_by_id():
    if not request.args.get("asked_id"):
        abort(400)
    asked_id = int(request.args.get('asked_id'))
    question = get_asked_question(asked_id)
    verify_is_lecturer(question.lecture)
    return json_response(question)


@lecture_routes.route("/getQuestionAnswer", methods=['GET'])
def get_question_answer_by_id():
    answer_id = get_option(request, 'id', default=None, cast=int)
    if answer_id:
        abort(400)
    ans = LectureAnswer.get_by_id(answer_id)
    if not ans:
        abort(404, 'Answer not found')
    verify_is_lecturer(ans.asked_question.lecture)
    return json_response(ans)


@lecture_routes.route("/stopQuestion", methods=['POST'])
def stop_question():
    """Route to stop question from running."""
    if not request.args.get("asked_id"):
        abort(400)
    asked_id = int(request.args.get('asked_id'))
    lecture = get_current_lecture_or_abort()
    verify_is_lecturer(lecture)
    Runningquestion.query.filter_by(asked_id=asked_id).delete()
    QuestionActivity.query.filter((QuestionActivity.asked_id == asked_id) &
                                  QuestionActivity.kind.in_([QuestionActivityKind.Usershown,
                                                             QuestionActivityKind.Useranswered])).delete(synchronize_session='fetch')
    db.session.commit()
    return ok_response()


@lecture_routes.route("/getLectureAnswers", methods=['GET'])
def get_lecture_answers():
    """Changing this to long poll requires removing threads."""
    asked_id = get_option(request, 'asked_id', None, cast=int)

    if not asked_id:
        return abort(400, "Bad request")

    question = get_asked_question(asked_id)
    verify_is_lecturer(question.lecture)
    if not question:
        return abort(404, "Asked question not found")
    after = get_option(request, 'after', default=question.asked_time, cast=dateutil.parser.parse)

    lecture_answers = question.answers.filter(LectureAnswer.answered_on > after).order_by(LectureAnswer.answered_on.asc()).all()

    return json_response(lecture_answers)


@lecture_routes.route("/answerToQuestion", methods=['PUT'])
def answer_to_question():
    if not request.args.get("asked_id") or not request.args.get('input'):
        abort(400, "missing asked_id or input")

    asked_id = int(request.args.get("asked_id"))
    req_input = json.loads(request.args.get("input"))
    answer = req_input['answers']
    whole_answer = answer
    lecture = get_current_lecture_or_abort()
    lecture_id = lecture.lecture_id
    u = get_current_user_object()
    asked_question = get_asked_question(asked_id)

    lecture_answer: LectureAnswer = asked_question.answers.filter_by(user_id=u.id).first()

    question = asked_question.running_question
    already_answered = asked_question.has_activity(QuestionActivityKind.Useranswered, u)
    if not question:
        return json_response({"questionLate": "The question has already finished. Your answer was not saved."})
    if already_answered:
        return json_response({"alreadyAnswered": "You have already answered to question. Your first answer is saved."})

    asked_question.add_activity(QuestionActivityKind.Useranswered, u)

    if (not lecture_answer) or (lecture_answer and answer != lecture_answer.answer):
        time_now = datetime.now(timezone.utc)
        question_points = asked_question.points
        points_table = create_points_table(question_points)
        points = calculate_points_from_json_answer(answer, points_table)
        answer = json.dumps(whole_answer)
        if lecture_answer and u.id != 0:
            lecture_answer.answered_on = time_now
            lecture_answer.answer = answer
            lecture_answer.points = points
        else:
            ans = LectureAnswer(user_id=u.id, question_id=asked_id, lecture_id=lecture_id, answer=answer,
                                answered_on=time_now, points=points)
            db.session.add(ans)
        db.session.commit()

    return ok_response()


@lecture_routes.route("/closePoints", methods=['PUT'])
def close_points():
    asked_id = get_option(request, 'asked_id', None, cast=int)
    if not asked_id:
        return abort(400, "Missing asked_id")

    lecture = get_current_lecture_or_abort()

    q = get_asked_question(asked_id)
    if not q:
        return abort(404)

    points = get_shown_points(lecture)
    if points:
        q.add_activity(QuestionActivityKind.Pointsclosed, get_current_user_object())
        db.session.commit()

    return ok_response()
