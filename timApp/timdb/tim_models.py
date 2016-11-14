"""
Defines the persistent data models used by TIM.

Each model MUST have 'tim_main' as the __bind_key__ attribute.

__tablename__ is not mandatory but recommended in order to maintain the naming convention for tables. The default table
name is class name in lowercase.

Keep the model classes in alphabetical order.

Use Flask-Migrate for database migrations. See <http://flask-migrate.readthedocs.io/en/latest/>.
"""
import datetime
import inspect
import sys
from datetime import timezone

from flask.ext.sqlalchemy import SQLAlchemy
from sqlalchemy import func
from sqlalchemy.schema import CreateTable

from timdb.readparagraphtype import ReadParagraphType

db = SQLAlchemy()


class AccessType(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'accesstype'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False)


class Answer(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'answer'
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Text, nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    points = db.Column(db.Float)
    answered_on = db.Column(db.DateTime(timezone=True), nullable=False)
    valid = db.Column(db.Boolean, nullable=False)
    last_points_modifier = db.Column(db.Integer, db.ForeignKey('usergroup.id'))

    def __init__(self, task_id, content, points, valid, last_points_modifier=None):
        self.task_id = task_id
        self.content = content
        self.points = points
        self.valid = valid
        self.last_points_modifier = last_points_modifier
        self.answered_on = datetime.datetime.now(timezone.utc)


class AnswerTag(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'answertag'
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answer.id'), nullable=False)
    tag = db.Column(db.Text, nullable=False)


class AnswerUpload(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'answerupload'
    upload_block_id = db.Column(db.Integer, db.ForeignKey('block.id'), primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answer.id'))

    block = db.relationship('Block', backref=db.backref('answerupload', lazy='dynamic'))
    answer = db.relationship('Answer', backref=db.backref('uploads', lazy='dynamic'))

    def __init__(self, block, answer=None):
        self.block = block
        self.answer = answer


class AskedJson(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'askedjson'
    asked_json_id = db.Column(db.Integer, primary_key=True)
    json = db.Column(db.Text, nullable=False)
    hash = db.Column(db.Text, nullable=False)


class AskedQuestion(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'askedquestion'
    asked_id = db.Column(db.Integer, primary_key=True)
    lecture_id = db.Column(db.Integer, db.ForeignKey('lecture.lecture_id'), nullable=False)  # NOTE Added foreign key
    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'))  # NOTE Added foreign key
    par_id = db.Column(db.Text)
    asked_time = db.Column(db.DateTime(timezone=True), nullable=False)
    points = db.Column(db.Text)  # TODO Should possibly be numeric
    asked_json_id = db.Column(db.Integer, db.ForeignKey('askedjson.asked_json_id'), nullable=False)
    expl = db.Column(db.Text)


class BlockAccess(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'blockaccess'
    block_id = db.Column(db.Integer, db.ForeignKey('block.id'), primary_key=True)
    usergroup_id = db.Column(db.Integer, db.ForeignKey('usergroup.id'), primary_key=True)
    type = db.Column(db.Integer, db.ForeignKey('accesstype.id'), primary_key=True)
    accessible_from = db.Column(db.DateTime(timezone=True), default=func.now())
    accessible_to = db.Column(db.DateTime(timezone=True))

    block = db.relationship('Block', backref=db.backref('accesses', lazy='dynamic'))


class Lecture(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'lecture'
    lecture_id = db.Column(db.Integer, primary_key=True)
    lecture_code = db.Column(db.Text)
    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=False)  # NOTE Added foreign key
    lecturer = db.Column(db.Integer, db.ForeignKey('useraccount.id'), nullable=False)  # NOTE Added foreign key
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True))
    password = db.Column(db.Text)
    options = db.Column(db.Text)


class LectureAnswer(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'lectureanswer'
    answer_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'), nullable=False)  # NOTE Added foreign key
    question_id = db.Column(db.Integer, db.ForeignKey('askedquestion.asked_id'),
                            nullable=False)  # NOTE Added foreign key
    lecture_id = db.Column(db.Integer, db.ForeignKey('lecture.lecture_id'), nullable=False)  # NOTE Added foreign key
    answer = db.Column(db.Text, nullable=False)
    answered_on = db.Column(db.DateTime(timezone=True), nullable=False)
    points = db.Column(db.Float)


class LectureUsers(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'lectureusers'
    lecture_id = db.Column(db.Integer, db.ForeignKey('lecture.lecture_id'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'),
                        primary_key=True)  # NOTE The foreign key was wrong in schema2


class Message(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'message'
    msg_id = db.Column(db.Integer, primary_key=True)
    lecture_id = db.Column(db.Integer, db.ForeignKey('lecture.lecture_id'),
                           nullable=False)  # NOTE The foreign key was wrong in schema2
    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'),
                        nullable=False)  # NOTE The foreign key was wrong in schema2
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False)


class NewUser(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'newuser'
    email = db.Column(db.Text, primary_key=True)
    pass_ = db.Column('pass', db.Text, nullable=False)
    created = db.Column(db.DateTime(timezone=True), nullable=False)


class Notification(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'notification'
    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'), primary_key=True)  # NOTE Added foreign key
    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), primary_key=True)
    email_doc_modify = db.Column(db.Boolean, nullable=False, default=False)
    email_comment_add = db.Column(db.Boolean, nullable=False, default=False)
    email_comment_modify = db.Column(db.Boolean, nullable=False, default=False)


class Question(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'question'
    question_id = db.Column(db.Integer, primary_key=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=False)  # NOTE Added foreign key
    par_id = db.Column(db.Text, nullable=False)
    question_title = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text)
    questionjson = db.Column(db.Text)
    points = db.Column(db.Text)
    expl = db.Column(db.Text)


class ReadParagraph(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'readparagraphs'
    usergroup_id = db.Column(db.Integer, primary_key=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), primary_key=True)  # NOTE Added foreign key
    par_id = db.Column(db.Text, primary_key=True)
    type = db.Column(db.Enum(ReadParagraphType), nullable=False, primary_key=True)
    par_hash = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False, default=func.now())


class Translation(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'translation'
    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), primary_key=True)
    src_docid = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=False)
    lang_id = db.Column(db.Text, nullable=False)
    doc_title = db.Column(db.Text)


class UserAnswer(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'useranswer'
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answer.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'), nullable=False)
    __table_args__ = (db.UniqueConstraint('answer_id', 'user_id'),)


class UserGroupMember(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'usergroupmember'
    usergroup_id = db.Column(db.Integer, db.ForeignKey('usergroup.id'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'), primary_key=True)


class UserNotes(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'usernotes'
    id = db.Column(db.Integer, primary_key=True)
    usergroup_id = db.Column(db.Integer, db.ForeignKey('usergroup.id'), nullable=False)  # NOTE Added foreign key
    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=False)  # NOTE Added foreign key
    par_id = db.Column(db.Text, nullable=False)
    par_hash = db.Column(db.Text, nullable=False)
    content = db.Column(db.Text, nullable=False)
    created = db.Column(db.DateTime(timezone=True), nullable=False)
    modified = db.Column(db.DateTime(timezone=True))
    access = db.Column(db.Text, nullable=False)
    tags = db.Column(db.Text, nullable=False)
    html = db.Column(db.Text)


class Version(db.Model):
    __bind_key__ = 'tim_main'
    __tablename__ = 'version'
    id = db.Column(db.Integer, primary_key=True)
    updated_on = db.Column(db.DateTime(timezone=True))

    def __init__(self, version_id):
        self.id = version_id
        self.updated_on = datetime.datetime.now(timezone.utc)
