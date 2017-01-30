"""The module contains the database functions related to velp groups and their default and show selections. This
includes adding new velp groups and editing the information of their default and show selections in the document (and
its paragraphs). The module also retrieves or creates the default and personal velp groups. Information about velp group
selections are managed through this module. The module also retrieves the velp groups and their default and show
selections from the database.

:authors: Joonas Lattu, Petteri Palojärvi
:copyright: 2016 Timber project members
:version: 1.0.0

"""

import copy
from typing import Optional, List, Iterable, Dict

from timdb.models.docentry import DocEntry
from timdb.timdbbase import TimDbBase


class VelpGroups(TimDbBase):

    def create_default_velp_group(self, name: str, owner_group_id: int, default_group_path: str):
        """Creates default velp group for document.

        :param name: Name of the new default velp group.
        :param owner_group_id: The id of the owner group.
        :param default_group_path: Path of new document / velp group
        :return:

        """

        # Create new document and add its ID to VelpGroupTable
        new_group = DocEntry.create(default_group_path, owner_group_id)
        new_group_id = new_group.id
        valid_until = None
        cursor = self.db.cursor()
        cursor.execute("""
                      INSERT INTO
                      VelpGroup(id, name, valid_until, default_group, creation_time)
                      VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                      ON CONFLICT DO NOTHING
                      """, [new_group_id, name, valid_until, True]
                       )
        self.db.commit()
        return new_group_id

    def create_velp_group(self, name: str, owner_group_id: int, new_group_path: str, valid_until: Optional[str] = None):
        """Create a velp group.

        :param name: Name of the created group.
        :param owner_group_id: The id of the owner group.
        :param new_group_path: Path of new document / velp group
        :param valid_until: How long velp group is valid (None is forever).
        :return: new velp group ID

        """

        # Create new document and add its ID to VelpGroupTable
        new_group = DocEntry.create(new_group_path, owner_group_id)
        new_group_id = new_group.id
        cursor = self.db.cursor()
        cursor.execute("""
                      INSERT INTO
                      VelpGroup(id, name, valid_until, creation_time)
                      VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                      """, [new_group_id, name, valid_until]
                       )
        self.db.commit()
        return new_group_id

    def make_document_a_velp_group(self, name: str, velp_group_id: int, valid_until: Optional[str] = None,
                                   default_group: Optional[bool] = False):
        """Adds document to VelpGroup table.

        :param name: Name of the created group.
        :param velp_group_id: ID of new velp group (and existing document)
        :param valid_until: How long velp group is valid (None is forever)
        :param default_group: Boolean whether velp group should be default or not
        :return: velp group ID

        """
        cursor = self.db.cursor()

        cursor.execute("""
                      INSERT INTO
                      VelpGroup(id, name, valid_until, default_group, creation_time)
                      VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                      ON CONFLICT DO NOTHING
                      """, [velp_group_id, name, valid_until, default_group]
                       )
        self.db.commit()
        return velp_group_id

    def update_velp_group_to_default_velp_group(self, velp_group_id: int):
        """Makes velp group a default velp group in velp group table.

        :param velp_group_id: ID of velp group

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      UPDATE VelpGroup
                      SET default_group = TRUE, valid_until = NULL
                      WHERE id = %s
                      """, [velp_group_id]
                       )
        self.db.commit()

    def check_velp_group_ids_for_default_group(self, velp_group_ids: List[int]):
        """Checks if list of velp group IDs contains a default velp group.

        :param velp_group_ids: List of velp group IDs
        :return: First found default velp group ID and name

        """
        if not velp_group_ids:
            return None
        cursor = self.db.cursor()
        cursor.execute("""
                      SELECT
                      id, name
                      FROM VelpGroup
                      WHERE id IN ({}) AND default_group = TRUE
                      """.format(self.get_sql_template(velp_group_ids)), velp_group_ids
                       )
        results = self.resultAsDictionary(cursor)
        return results[0] if len(results) > 0 else None

    def add_velp_to_group(self, velp_id: int, velp_group_id: int):
        """Adds a velp to a specific group.

        :param velp_id: Velp if
        :param velp_group_id: Velp group ID

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      INSERT INTO
                      VelpInGroup(velp_group_id, velp_id)
                      VALUES (%s, %s)
                      ON CONFLICT DO NOTHING
                      """, [velp_group_id, velp_id]
                       )
        self.db.commit()

    def add_velp_to_groups(self, velp_id: int, velp_group_ids: [int]):
        """Adds a velp to specific groups.

        :param velp_id: ID of velp
        :param velp_group_ids: List of velp group IDs

        """
        cursor = self.db.cursor()
        for velp_group in velp_group_ids:
            cursor.execute("""
                          INSERT INTO
                          VelpInGroup(velp_group_id, velp_id)
                          VALUES (%s, %s)
                          ON CONFLICT DO NOTHING
                          """, [velp_group, velp_id]
                           )
        self.db.commit()

    def remove_velp_from_group(self, velp_id: int, velp_group_id: int):
        """Removes a velp from a specific group.

        :param velp_id: Velp id
        :param velp_group_id: Velp group id

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      DELETE
                      FROM VelpInGroup
                      WHERE velp_id = %s AND velp_group_id = %s
                      """, [velp_id, velp_group_id]
                       )
        self.db.commit()

    def remove_velp_from_groups(self, velp_id: int, velp_group_ids: [int]):
        """Removes a velp from specific groups.

        :param velp_id: ID of velp
        :param velp_group_ids: List of velp group IDs

        """
        cursor = self.db.cursor()
        for velp_group in velp_group_ids:
            cursor.execute("""
                          DELETE
                          FROM VelpInGroup
                          WHERE velp_id = %s AND velp_group_id = %s
                          """, [velp_id, velp_group]
                           )
        self.db.commit()

    def get_velp_group_name(self, velp_group_id: int) -> str:
        """Gets velp group's name.

        :param velp_group_id: velp group ID
        :return: velp group's name as a string.

        """
        cursor = self.db.cursor()
        cursor.execute('SELECT name FROM VelpGroup WHERE id = %s', [velp_group_id])
        result = cursor.fetchone()
        return result[0] if result is not None else None

    def get_groups_for_velp(self, velp_id):
        """Gets velp group's of the velp.

        :param velp_id: velp ID
        :return: velp groups of the velp.

        """
        cursor = self.db.cursor()
        cursor.execute('SELECT velp_group_id AS id FROM VelpInGroup WHERE velp_id = %s', [velp_id])
        result = self.resultAsDictionary(cursor)
        return result

    def is_id_velp_group(self, doc_id: int) -> bool:
        """Checks whether given document id can also be found from VelpGroup table.

        :param doc_id: ID of document
        :return: True if part of VelpGroup table, else False

        """
        cursor = self.db.cursor()
        cursor.execute('SELECT name FROM VelpGroup WHERE id = %s', [doc_id])
        result = cursor.fetchone()
        return True if result is not None else False

    def add_group_to_imported_table(self, user_group: int, doc_id: int, target_type: int, target_id: int,
                                    velp_group_id: int):
        """Adds velp groups to ImportedVelpGroups table for specific document / user group combo.

        :param user_group: ID of user group
        :param doc_id: Id of document
        :param target_type: Which kind of area group targets to (0 doc, 1 paragraph, 2 area)
        :param target_id:  ID of target (0 for documents)
        :param velp_group_id: ID of velp group
        :return: void

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      INSERT INTO
                      ImportedVelpGroups(user_group, doc_id, target_type, target_id, velp_group_id)
                      VALUES (%s, %s, %s, %s, %s)
                      ON CONFLICT DO NOTHING
                      """, [user_group, doc_id, target_type, target_id, velp_group_id]
                       )
        self.db.commit()

        return

    def get_groups_from_imported_table(self, user_groups: [int], doc_id: int):
        """Gets velp groups from ImportedVelpGroups table for specific document / user group IDs combo.

        :param user_groups: List of user group IDs
        :param doc_id: ID of document
        :return: velp groups in document that user has access to via group.

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      SELECT
                      user_group, doc_id, target_type, target_id, velp_group_id as id
                      FROM ImportedVelpGroups
                      WHERE doc_id = %s AND user_group IN ({})
                      """.format(self.get_sql_template(user_groups)), [doc_id] + user_groups
                       )
        results = self.resultAsDictionary(cursor)
        return results

    def add_groups_to_document(self, velp_groups: Iterable[Dict], doc_id: int, user_id: int):
        """Adds velp groups to VelpGroupsInDocument table.

        :param velp_groups: Velp groups as dictionaries
        :param doc_id: ID of document
        :param user_id: ID of user

        """
        cursor = self.db.cursor()
        for velp_group in velp_groups:
            velp_group_id = velp_group['id']
            cursor.execute("""
                          INSERT INTO
                          VelpGroupsInDocument(user_id, doc_id, velp_group_id)
                          VALUES (%s, %s, %s)
                          ON CONFLICT DO NOTHING
                          """, [user_id, doc_id, velp_group_id]
                           )
        self.db.commit()

    def get_groups_from_document_table(self, doc_id: int, user_id: int):
        """Gets velp groups from VelpGroupsInDocument table of specific document / user combo.

        :param doc_id: ID of document
        :param user_id: ID of user
        :return: velp groups in document that user has access to.

        """

        cursor = self.db.cursor()
        cursor.execute("""
                       SELECT
                         DISTINCT(VelpGroupsInDocument.velp_group_id) AS id,
                         VelpGroup.name,
                         DocEntry.name AS location
                       FROM VelpGroupsInDocument
                         INNER JOIN VelpGroup ON VelpGroup.id = VelpGroupsInDocument.velp_group_id
                         INNER JOIN DocEntry ON DocEntry.id = VelpGroupsInDocument.velp_group_id
                       WHERE doc_id = %s AND user_id = %s
                       """, [doc_id, user_id]
                       )
        # Get only the first result in case there are several entries in DocEntry
        results = self.resultAsDictionary(cursor)
        return results

    def add_groups_to_selection_table(self, velp_groups: dict, doc_id: int, user_id: int):
        """Adds velp groups to VelpGroupSelection table.

        :param velp_groups: Velp groups as dictionaries
        :param doc_id: ID of document
        :param user_id: ID of user

        """
        cursor = self.db.cursor()
        for velp_group in velp_groups:
            target_type = velp_group['target_type']
            target_id = velp_group['target_id']
            selected = True
            velp_group_id = velp_group['id']
            cursor.execute("""
                          INSERT INTO
                          VelpGroupSelection(user_id, doc_id, target_type, target_id, selected, velp_group_id)
                          VALUES (%s, %s, %s, %s, %s, %s)
                          ON CONFLICT DO NOTHING
                          """, [user_id, doc_id, target_type, target_id, selected, velp_group_id]
                           )
        self.db.commit()

    def get_personal_selections_for_velp_groups(self, doc_id: int, user_id: int):
        """Gets all velp group personal selections for document.

        :param doc_id: ID of document
        :param user_id: ID of user
        :return: Dict with following info { target_id: [{velp_group_id, selected}, etc], etc }

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      SELECT
                      target_id, velp_group_id, selected
                      FROM VelpGroupSelection
                      WHERE doc_id = %s AND user_id = %s
                      ORDER BY target_id ASC
                      """, [doc_id, user_id]
                       )
        results = self.resultAsDictionary(cursor)

        if results:
            target_id = results[0]['target_id']
            list_help = []
            target_dict = dict()
            group_dict = dict()
            if target_id != '0':
                target_dict['0'] = []
            for i in range(len(results)):
                next_id = results[i]['target_id']
                if next_id != target_id:
                    target_dict[target_id] = copy.deepcopy(list_help)
                    target_id = next_id
                    del list_help[:]
                    group_dict['id'] = results[i]['velp_group_id']
                    if results[i]['selected']:
                        group_dict['selected'] = True
                    else:
                        group_dict['selected'] = False
                    list_help.append(copy.deepcopy(group_dict))
                    group_dict.clear()
                else:
                    group_dict['id'] = results[i]['velp_group_id']
                    if results[i]['selected']:
                        group_dict['selected'] = True
                    else:
                        group_dict['selected'] = False
                    list_help.append(copy.deepcopy(group_dict))
                    group_dict.clear()
                if i == len(results) - 1:
                    target_dict[target_id] = copy.deepcopy(list_help)
            print(target_dict)
            return target_dict
        else:
            return {'0': []}

    def get_default_selections_for_velp_groups(self, doc_id: int, user_id: int):
        """Gets all velp group default selections for document.

        :param doc_id: ID of document
        :param user_id: ID of user
        :return: Dict with following info { target_id: [{velp_group_id, selected}, etc], etc }

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      SELECT DISTINCT
                      VelpGroupDefaults.target_id, VelpGroupDefaults.velp_group_id, VelpGroupDefaults.selected
                      FROM VelpGroupDefaults
                      LEFT JOIN VelpGroupsInDocument ON VelpGroupsInDocument.doc_id = VelpGroupDefaults.doc_id
                      AND VelpGroupsInDocument.velp_group_id = VelpGroupDefaults.velp_group_id
                      WHERE VelpGroupsInDocument.doc_id = %s AND VelpGroupsInDocument.user_id = %s
                      AND VelpGroupsInDocument.doc_id = VelpGroupDefaults.doc_id
                      ORDER BY VelpGroupDefaults.target_id ASC
                      """, [doc_id, user_id]
                       )
        results = self.resultAsDictionary(cursor)

        if results:
            target_id = results[0]['target_id']
            list_help = []
            target_dict = dict()
            group_dict = dict()
            if target_id != '0':
                target_dict['0'] = []
            for i in range(len(results)):
                next_id = results[i]['target_id']
                if next_id != target_id:
                    target_dict[target_id] = copy.deepcopy(list_help)
                    target_id = next_id
                    del list_help[:]
                    group_dict['id'] = results[i]['velp_group_id']
                    if results[i]['selected']:
                        group_dict['selected'] = True
                    else:
                        group_dict['selected'] = False
                    list_help.append(copy.deepcopy(group_dict))
                    group_dict.clear()
                else:
                    group_dict['id'] = results[i]['velp_group_id']
                    if results[i]['selected']:
                        group_dict['selected'] = True
                    else:
                        group_dict['selected'] = False
                    list_help.append(copy.deepcopy(group_dict))
                    group_dict.clear()
                if i == len(results) - 1:
                    target_dict[target_id] = copy.deepcopy(list_help)
            print(target_dict)
            return target_dict

        else:
            return {'0': []}

    # Methods for changing selections

    def change_selection(self, doc_id: int, velp_group_id: int, target_type: int, target_id: str, user_id: int,
                         selected: bool):
        """Changes selection for velp group in VelpGroupSelection for specific user / document / target combo.

        :param doc_id: ID of document
        :param velp_group_id: ID of velp group
        :param target_type: 0 document, 1 paragraph
        :param target_id: ID of targeted area
        :param user_id: ID of user
        :param selected: Boolean whether group is selected or not

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      DELETE FROM VelpGroupSelection
                      WHERE user_id = %s AND doc_id = %s AND velp_group_id = %s AND target_type = %s AND target_id = %s
                      """, [user_id, doc_id, velp_group_id, target_type, target_id]
                       )
        cursor.execute("""
                      INSERT INTO
                      VelpGroupSelection(user_id, doc_id, velp_group_id, target_type, target_id, selected)
                      VALUES (%s, %s, %s, %s, %s, %s)
                        """, [user_id, doc_id, velp_group_id, target_type, target_id, selected]
                       )
        self.db.commit()

    def change_all_target_area_selections(self, doc_id: int, target_type: int, target_id: str, user_id: int,
                                          selected: bool):
        """Change all personal selections to True or False for currently chose area (document or paragraph)

        :param doc_id: ID of document
        :param target_type: Currently 0 = document, 1 = paragraph
        :param target_id: ID of target ('0' for documents)
        :param user_id: ID of user
        :param selected: True or False

        """
        cursor = self.db.cursor()
        if target_type == 0:
            cursor.execute("""
                      UPDATE VelpGroupSelection
                      SET selected = %s
                      WHERE doc_id = %s AND target_id = %s AND user_id = %s
                      """, [selected, doc_id, target_id, user_id]
                           )
        elif target_type == 1:
            cursor.execute("""
                          DELETE FROM VelpGroupSelection
                          WHERE user_id = %s AND doc_id = %s AND target_type = %s AND target_id = %s
                          """, [user_id, doc_id, target_type, target_id]
                           )
            cursor.execute("""
                          INSERT INTO
                          VelpGroupSelection(user_id, doc_id, target_type, target_id, velp_group_id, selected)
                          SELECT %s, %s, %s, %s, velp_group_id, %s FROM VelpGroupSelection WHERE doc_id = %s AND
                          user_id = %s AND target_type = 0
                            """, [user_id, doc_id, target_type, target_id, selected, doc_id, user_id]
                           )
            # target_type is 0 because only 0 always contains all velp groups user has access to.
            # Other target types will get added to database only after they've been clicked once in interface.
        self.db.commit()

    def change_default_selection(self, doc_id: int, velp_group_id: int, target_type: int, target_id: str,
                                 selected: bool):
        """Changes selection for velp group's default selection in target area.

        :param doc_id: ID of document
        :param target_type: 0 document, 1 paragraph
        :param target_id: ID of targeted area
        :param velp_group_id: ID of velp group
        :param selected: Boolean whether group is selected or not

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      DELETE FROM VelpGroupDefaults
                      WHERE doc_id = %s AND velp_group_id = %s AND target_type = %s AND target_id = %s
                      """, [doc_id, velp_group_id, target_type, target_id]
                       )
        cursor.execute("""
                      INSERT INTO
                      VelpGroupDefaults(doc_id, target_type, target_id, selected, velp_group_id)
                      SELECT %s, %s, %s, %s, %s
                      ON CONFLICT DO NOTHING
                      """, [doc_id, target_type, target_id, selected, velp_group_id]
                       )
        self.db.commit()

    def change_all_target_area_default_selections(self, doc_id: int, target_type: int, target_id: str, user_id: int,
                                                  selected: bool):
        """Change all default selections to True or False for currently chose area (document or paragraph)

        :param doc_id: ID of document
        :param target_type: Currently 0 = document, 1 = paragraph
        :param target_id: ID of target ('0' for documents)
        :param user_id: ID of user (with manage access) to get all defaults from that user's selection table
        :param selected: True or False

        """
        cursor = self.db.cursor()
        cursor.execute("""
                        DELETE FROM VelpGroupDefaults
                        WHERE doc_id = %s AND target_type = %s AND target_id = %s
                        """, [doc_id, target_type, target_id]
                       )
        cursor.execute("""
                        INSERT INTO
                        VelpGroupDefaults(doc_id, target_type, target_id, velp_group_id, selected)
                        SELECT %s, %s, %s, velp_group_id, %s
                        FROM VelpGroupsInDocument
                        WHERE doc_id = %s AND user_id = %s
                          """, [doc_id, target_type, target_id, selected, doc_id, user_id]
                       )
        self.db.commit()

    def reset_target_area_selections_to_defaults(self, doc_id: int, target_id: str, user_id: int):
        """Changes user's personal velp group selections in target area to defaults.

        :param doc_id: ID of document
        :param target_id: ID of target area
        :param user_id: ID of user

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      DELETE FROM VelpGroupSelection
                      WHERE user_id = %s AND doc_id = %s AND target_id = %s
                      """, [user_id, doc_id, target_id]
                       )
        self.db.commit()

    def reset_all_selections_to_defaults(self, doc_id: int, user_id: int):
        """Changes user's all personal velp group selections in document to defaults.

        :param doc_id: ID of document
        :param user_id: ID of user

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      DELETE FROM VelpGroupSelection
                      WHERE user_id = %s AND doc_id = %s
                      """, [user_id, doc_id]
                       )
        self.db.commit()

    # Unused methods

    def update_velp_group(self, velp_group_id: int, name: str, valid_until: Optional[str]):
        """Updates name and/or valid until time of velp group.

        :param velp_group_id: Velp group id
        :param name: Name of velp group
        :param valid_until: How long velp group is valid

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      UPDATE VelpGroup
                      SET name = %s AND  valid_until = %s
                      WHERE id = %s
                      """, [name, valid_until, velp_group_id]
                       )
        self.db.commit()

    def delete_velp_group(self, velp_group_id: int):
        """Deletes velp group. Doesn't delete velps belonging to group, only their links to deleted group.

        :param velp_group_id: Velp group id

        """
        cursor = self.db.cursor()
        cursor.execute("""
                      DELETE
                      FROM VelpGroup
                      WHERE  id = %s;
                      DELETE
                      FROM VelpInGroup
                      WHERE velp_group_id = %s
                      """, [velp_group_id, velp_group_id]
                       )

    # TODO: Unused
    def add_groups_to_default_table(self, velp_groups: dict, doc_id: int):
        """Adds velp groups to VelpGroupDefaults table.

        :param velp_groups: Velp groups as dictionaries
        :param doc_id: ID of document

        """
        cursor = self.db.cursor()
        for velp_group in velp_groups:
            target_type = 0
            target_id = 0
            selected = True
            velp_group_id = velp_group['id']
            cursor.execute("""
                          INSERT INTO
                          VelpGroupDefaults(doc_id, target_type, target_id, selected, velp_group_id)
                          VALUES (%s, %s, %s, %s, %s)
                          ON CONFLICT DO NOTHING
                          """, [doc_id, target_type, target_id, selected, velp_group_id]
                           )
        self.db.commit()
