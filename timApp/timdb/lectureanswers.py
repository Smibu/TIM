from datetime import datetime
from typing import List, Optional

__author__ = 'hajoviin'
from timdb.timdbbase import TimDbBase


class LectureAnswers(TimDbBase):
    """LectureAnswer class to handle database for lecture answers."""

    def add_answer(self, user_id: int, question_id: int, lecture_id: int, answer: str, answered_on: datetime,
                   points: float, commit: bool=True):
        """Adds answer to lecture question.

        :param user_id: user id
        :param question_id: question id
        :param lecture_id: lecture id
        :param answer: answer
        :param answered_on: time of the answer
        :param points: points from the anwer
        :param commit: commit the database
        :return:

        """
        cursor = self.db.cursor()

        cursor.execute("""
            INSERT INTO LectureAnswer(user_id, question_id,lecture_id, answer, answered_on,points)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, [user_id, question_id, lecture_id, answer, answered_on, points])

        if commit:
            self.db.commit()

    def update_answer(self, answer_id: int, user_id: int, question_id: int, lecture_id: int, answer: str,
                      answered_on: datetime, points: float, commit: bool=True):
        """Update users answer to question.

        :param answer_id: answer id
        :param user_id: user id
        :param question_id: question id
        :param lecture_id: lecture id
        :param answer: answer
        :param answered_on: time of the answer
        :param points: points from the anwer
        :param commit: commit the database
        :return:

        """
        cursor = self.db.cursor()

        cursor.execute("""
            UPDATE LectureAnswer
            SET user_id = %s, question_id = %s, lecture_id = %s, answer = %s, answered_on = %s, points = %s
            WHERE answer_id = %s
        """, [user_id, question_id, lecture_id, answer, answered_on, points, answer_id])

        if commit:
            self.db.commit()

    def update_answer_points(self, answer_id: int, points: float, commit: bool=True):
        """Update answers points.

        :param answer_id: answer id
        :param points: new points
        :param commit: commit the database
        :return:

        """
        cursor = self.db.cursor()

        cursor.execute("""
            UPDATE LectureAnswer
            SET points = %s
            WHERE answer_id = %s
        """, [points, answer_id])

        if commit:
            self.db.commit()

    def get_answers_to_question(self, question_id: int, timestamp: Optional[str]=None) -> List[dict]:
        """Gets answers from specific question.

        :param question_id: question id
        :param timestamp: gets answer that came after this time (optional)
        :return:

        """
        cursor = self.db.cursor()

        if timestamp is None:
            cursor.execute("""
            SELECT answer_id, answer
            FROM LectureAnswer
            WHERE question_id = %s
        """, [question_id])
        else:
            cursor.execute("""
            SELECT answer_id, answer
            FROM LectureAnswer
            WHERE question_id = %s AND answered_on > %s
        """, [question_id, timestamp])

        return self.resultAsDictionary(cursor)

    def get_user_answer_to_question(self, asked_id: int, user_id: int) -> List[dict]:
        """Gets users answer to specific question.

        :param asked_id: asked question id
        :param user_id: user id
        :return:

        """
        cursor = self.db.cursor()

        cursor.execute("""
            SELECT answer_id, answer, points
            FROM LectureAnswer
            WHERE question_id = %s AND user_id = %s
        """, [asked_id, user_id])

        return self.resultAsDictionary(cursor)

    def get_answers_to_questions_from_lecture(self, lecture_id: int) -> List[dict]:
        """Gets all the answers to questions from specific lecture.

        :param lecture_id: lecture ID
        :return:

        """
        cursor = self.db.cursor()

        cursor.execute("""
                        SELECT answer_id, user_id, question_id, lecture_id, answer, answered_on, points, name as user_name
                        FROM LectureAnswer
                        JOIN UserAccount ON LectureAnswer.user_id = UserAccount.id
                        WHERE lecture_id = %s
        """, [lecture_id])

        return self.resultAsDictionary(cursor)

    def get_totals(self, lecture_id: int, user_id: Optional[int]=None):
        cursor = self.db.cursor()
        condition = 'AND u.id = %s' if user_id is not None else ''
        cursor.execute("""SELECT u.name, SUM(a.points) as sum, COUNT(*) as count
        FROM LectureAnswer a
        JOIN UserAccount u ON a.user_id = u.id
        WHERE a.lecture_id = %s
        {}
        GROUP BY u.name
        ORDER BY u.name""".format(condition), [lecture_id] if user_id is None else [lecture_id, user_id])
        return self.resultAsDictionary(cursor)

    def get_user_answers_to_questions_from_lecture(self, lecture_id: int, user_id: int) -> List[dict]:
        """Gets all the answers to questions from specific lecture.

        :param lecture_id: lecture ID
        :return:

        """
        cursor = self.db.cursor()

        cursor.execute("""
                        SELECT answer_id, user_id, question_id, lecture_id, answer, answered_on, points, name as user_name
                        FROM LectureAnswer
                        JOIN UserAccount ON LectureAnswer.user_id = UserAccount.id
                        WHERE lecture_id = %s AND user_id = %s
        """, [lecture_id, user_id])

        return self.resultAsDictionary(cursor)

    def delete_answers_from_question(self, question_id: int, commit: bool=True):
        """Deletes answers from question.

        :param question_id: question
        :param commit: commit to database
        :return:

        """
        cursor = self.db.cursor()

        cursor.execute("""
                    DELETE FROM LectureAnswer
                    WHERE question_id = %s
        """, [question_id])

        if commit:
            self.db.commit()
