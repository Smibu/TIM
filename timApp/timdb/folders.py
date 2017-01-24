from typing import List, Optional, Iterable

from timdb.blocktypes import blocktypes
from timdb.models.block import Block
from timdb.models.folder import Folder
from timdb.models.user import User
from timdb.tim_models import BlockAccess, db
from timdb.timdbbase import TimDbBase

ID_ROOT_FOLDER = -1

class Folders(TimDbBase):
    def get(self, block_id: int) -> Optional[dict]:
        """Gets the metadata information of the specified folder.

        :param block_id: The block id of the folder to be retrieved.
        :returns: A row representing the folder.
        """
        cursor = self.db.cursor()
        cursor.execute('SELECT id, name, location FROM Folder WHERE id = %s', [block_id])

        for folder in self.resultAsDictionary(cursor):
            folder['path'] = self.join_location(folder['location'], folder['name'])
            return folder

        return None

    def exists(self, folder_id: int) -> bool:
        """Checks whether a folder with the specified id exists.

        :param folder_id: The id of the folder.
        :returns: True if the folder exists, false otherwise.
        """
        cursor = self.db.cursor()
        cursor.execute('SELECT EXISTS(SELECT id FROM Folder WHERE id = %s)', [folder_id])
        return bool(int(cursor.fetchone()[0]))

    def get_folder_id(self, folder_name: str) -> Optional[int]:
        if folder_name == '':
            return ID_ROOT_FOLDER

        f = Folder.find_by_path(folder_name)
        return f.id if f else None

    def get_folders(self, root_path: str = '', filter_ids: Optional[Iterable[int]]=None) -> List[Folder]:
        """Gets all the folders under a path.
        :param root_path: Restricts the search to a specific folder.
        :param filter_ids: An optional iterable of document ids for filtering the documents.
               Must be non-empty if supplied.
        :return: A list of dictionaries of the form {'id': <folder_id>, 'name': 'folder_name', 'path': 'folder_path'}
        """
        q = Folder.query.filter_by(location=root_path)
        if filter_ids:
            q = q.filter(Folder.id.in_(filter_ids))
        return q.all()

    def rename(self, block_id: int, new_name: str) -> None:
        """Renames a folder, updating all the documents within.

        :param block_id: The id of the folder to be renamed.
        :param new_name: The new name for the folder.
        """

        folder_info = self.get(block_id)
        assert folder_info is not None, 'folder does not exist: ' + str(block_id)
        old_name = folder_info['path']
        new_rel_path, new_rel_name = self.split_location(new_name)

        # Rename folder itself
        cursor = self.db.cursor()
        cursor.execute('UPDATE Folder SET name = %s, location = %s WHERE id = %s',
                       [new_rel_name, new_rel_path, block_id])

        # Rename contents
        cursor.execute('SELECT name FROM DocEntry WHERE name LIKE %s', [old_name + '/%'])
        for row in cursor.fetchall():
            old_docname = row[0]
            new_docname = old_docname.replace(old_name, new_name)
            cursor.execute('UPDATE DocEntry SET name = %s WHERE name = %s',
                           [new_docname, old_docname])

        cursor.execute('UPDATE Folder SET location = %s WHERE location = %s', [new_name, old_name])
        cursor.execute('SELECT location FROM Folder WHERE location LIKE %s', [old_name + '/%'])
        for row in cursor.fetchall():
            old_docname = row[0]
            new_docname = old_docname.replace(old_name, new_name)
            cursor.execute('UPDATE Folder SET location = %s WHERE location = %s',
                           [new_docname, old_docname])


        self.db.commit()

    def is_empty(self, block_id: int) -> bool:
        folder_info = self.get(block_id)
        assert folder_info is not None, 'folder does not exist: ' + str(block_id)
        folder_name = folder_info['path']

        cursor = self.db.cursor()
        cursor.execute('SELECT exists(SELECT name FROM DocEntry WHERE name LIKE %s)', [folder_name + '/%'])
        return cursor.fetchone()[0] == 0

    def delete(self, block_id: int) -> None:
        """Deletes an empty folder.
        """
        folder_info = self.get(block_id)
        assert folder_info is not None, 'folder does not exist: ' + str(block_id)
        folder_name = folder_info['path']

        # Check that our folder is empty
        assert self.is_empty(block_id), 'folder {} is not empty!'.format(folder_name)

        # Delete it
        Folder.query.filter_by(id=block_id).delete()
        BlockAccess.query.filter_by(block_id=block_id).delete()
        Block.query.filter_by(type_id=blocktypes.FOLDER, id=block_id).delete()
        db.session.commit()

    def check_velp_group_folder_path(self, root_path: str, owner_group_id: int, doc_name: str):
        """ Checks if velp group folder path exists and if not, creates it

        :param root_path: Root path where method was called from
        :param owner_group_id: Owner group ID for the new folder if one is to be created
        :param doc_name:
        :return: Path for velp group folder
        """
        group_folder_name = "velp-groups"   # Name of the folder all velp groups end up in
        if root_path != "":
            velps_folder_path = root_path + "/" + group_folder_name
        else:
            velps_folder_path = group_folder_name
        doc_folder_path = velps_folder_path + "/" + doc_name
        velps_folder = False
        doc_velp_folder = False
        folders = self.get_folders(root_path)

        # Check if velps folder exist
        for folder in folders:
            if folder.name == group_folder_name:
                velps_folder = True

        # If velps folder exists, check if folder for document exists
        if velps_folder is True:
            doc_folders = self.get_folders(velps_folder_path)
            for folder in doc_folders:
                if folder.name == doc_name:
                    doc_velp_folder = True

        # If velps folder doesn't exist, create one
        if velps_folder is False:
            new_block = Folder.create(velps_folder_path, owner_group_id)

        if doc_name == "":
            return velps_folder_path

        # If folder for document in velps folder doesn't exists, create one
        if doc_velp_folder is False:
            new_block = Folder.create(doc_folder_path, owner_group_id)

        return doc_folder_path

    def check_personal_velp_folder(self, user: User, user_id: int):
        """ Checks if personal velp group folder path exists and if not, creates it

        :param user: Username of current user
        :param user_id: ID of current user
        :return:
        """
        group_folder_name = "velp-groups"
        user_folder = user.get_personal_folder().path
        user_velps_path = user_folder + "/" + group_folder_name
        folders = self.get_folders(user_folder)
        velps_folder = False

        for folder in folders:
            if folder.name == group_folder_name:
                velps_folder = True

        if velps_folder is False:
            new_block = Folder.create(user_velps_path, user_id)

        return user_velps_path
