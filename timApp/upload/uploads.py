import os

from timApp.item.blocktypes import blocktypes
from timApp.item.block import insert_block
from timApp.timdb.sqa import db
from timApp.answer.answer_models import AnswerUpload
from timApp.timdb.timdbbase import TimDbBase


class Uploads(TimDbBase):

    def get_file_path(self, path: str, filename: str):
        """Gets the path of for a file.  Creates a new dir by file_id one creater than number of files in dir.

        :param path: The path for the file
        :param filename: The filename of the image.
        :returns: The id and path of the image file.

        """
        p = os.path.join(self.blocks_path, path)
        if not os.path.exists(p):
            os.makedirs(p)
        file_id = len(os.listdir(p)) + 1
        relpath = os.path.join(path, str(file_id))
        p = os.path.join(self.blocks_path, relpath)
        os.makedirs(p)

        return os.path.join(relpath, filename), os.path.join(p, filename)

    def save_file(self, file_data: bytes, path: str, filename: str, owner_group_id: int) -> AnswerUpload:
        """Saves a file to the database.

        :param file_data: The  data.
        :param path: path for the file
        :param filename: The filename
        :param owner_group_id: The owner group of the file.
        :returns: The AnswerUpload object that was created.

        """

        # TODO: Check that the file extension is allowed.
        # TODO: Use imghdr module to do basic validation of the file contents.
        # TODO: Should file name be unique among images?
        relfilename, file_path = self.get_file_path(path, filename)

        with open(file_path, 'wb') as f:
            f.write(file_data)
        b = insert_block(description=relfilename, owner_group_id=owner_group_id,
                         block_type=blocktypes.UPLOAD)
        au = AnswerUpload(block=b)
        db.session.add(b)
        db.session.add(au)

        return au

    def get_file(self, relfilename: str) -> bytes:
        """Gets the specified file.

        :param relfilename: The filename.
        :returns: The content of the file.

        """

        p = os.path.join(self.blocks_path, relfilename)
        with open(p, 'rb') as f:
            return f.read()
