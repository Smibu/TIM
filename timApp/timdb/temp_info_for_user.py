"""
Used to handle temp data that is related to lecture, question and user
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import scoped_session

from timdb.tim_models import db


class TempInfoUserQuestion:
    def __init__(self, session: scoped_session, table: db.Model):
        self.session = session
        self.table = table

    def add_user_info(self, lecture_id: int, asked_id: int, user_id: int):
        user_info = self.table(lecture_id, asked_id, user_id)
        try:
            self.session.merge(user_info)
            self.session.commit()
        except IntegrityError:
            print("Info already exists")
            self.session.rollback()

    def delete_user_info(self, lecture_id: int, asked_id: int, user_id: int):
        self.table.query.filter_by(lecture_id=lecture_id, asked_id=asked_id, user_id=user_id).delete()
        self.session.commit()

    def delete_all_from_question(self, asked_id: int):
        self.table.query.filter_by(asked_id=asked_id).delete()
        self.session.commit()

    def delete_all_from_lecture(self, lecture_id: int):
        self.table.query.filter_by(lecture_id=lecture_id).delete()
        self.session.commit()

    def has_user_info(self, asked_id: int, user_id: int):
        rows = self.table.query.filter_by(asked_id=asked_id, user_id=user_id)
        rows = rows.all()
        return len(rows) > 0
