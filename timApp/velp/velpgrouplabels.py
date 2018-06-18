"""The module contains the database functions related to labels that are used in velp groups. This includes adding,
modifying and deleting velp group labels. The module also retrieves the velp group labels from the database. The module
is not yet used in production.

:authors: Joonas Lattu, Petteri Palojärvi
:copyright: 2016 Timber project members
:version: 1.0.0

"""

from timApp.timdb.timdbbase import TimDbBase, result_as_dict_list
from timApp.velp.velp_models import VelpGroupLabel


class VelpGroupLabels(TimDbBase):

    def create_velp_group_label(self, language_id: str, content: str) -> int:
        """Creates a new label.

        :param language_id: Language chosen
        :param content: Label content
        :return: id of the new label.

        """

        vgl = VelpGroupLabel(language_id=language_id,
                             content=content)
        self.session.add(vgl)
        self.session.commit()
        return vgl.id

    def add_translation(self, label_id: int, language_id: str, content: str):
        """Adds new translation to an existing label.

        :param label_id: Label id
        :param language_id: Language chosen
        :param content: New translation

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      INSERT INTO
                      VelpGroupLabel(id, language_id, content)
                      VALUES (%s, %s, %s)
                      """, [label_id, language_id, content]
                       )
        self.db.commit()

    def update_velp_group_label(self, label_id: int, language_id: str, content: str):
        """Updates content of label in specific language.

        :param label_id: Label id
        :param language_id: Language chosen
        :param content: Updated content

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      UPDATE VelpGroupLabel
                      SET content = %s
                      WHERE id = %s AND language_id = %s
                      """, [content, label_id, language_id]
                       )
        self.db.commit()

    def get_velp_group_labels(self, velp_id: int, language_id: str):
        """Gets information of labels for one velp in specific language.

        :param velp_id: ID of velp
        :param language_id: Language chosen
        :return: List of labels associated with velp as a dictionary

        """
        cursor = self.db.cursor()
        # todo get label content also. return something.
        cursor.execute("""
                      SELECT *
                      FROM VelpGroupLabel
                      WHERE language_id = %s AND (id IN
                      (SELECT velp_id FROM LabelInVelpGroup WHERE velp_id = %s))
                      """, [language_id, velp_id]
                       )
        return result_as_dict_list(cursor)

    def delete_velp_group_label(self, label_id):
        """Deletes label (use with extreme caution)

        :param label_id: Label ID

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      DELETE
                      FROM VelpGroupLabel
                      WHERE id = %s
                      """, [label_id]
                       )
