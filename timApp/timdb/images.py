import os
from typing import List, Tuple, Optional

from timApp.timdb.blocktypes import blocktypes
from timApp.timdb.exceptions import TimDbException
from timApp.timdb.models.block import Block, insert_block
from timApp.timdb.timdbbase import TimDbBase, result_as_dict_list


class Images(TimDbBase):

    def get_file_path(self, path: str, filename: str):
        """Gets the path of an image.

        :param path: The path for the file
        :param file_id: The id of the image.
        :param filename: The filename of the image.
        :returns: The id and path of the image file.

        """
        p = os.path.join(self.blocks_path, 'dl', path)
        if not os.path.exists(p):
            os.makedirs(p)
        file_id = len(os.listdir(p)) + 1
        p = os.path.join(self.blocks_path, 'dl', path, str(file_id))
        os.makedirs(p)

        return file_id, os.path.join(p, filename)

    def getImagePath(self, image_id: int, image_filename: str):
        """Gets the path of an image.

        :param image_id: The id of the image.
        :param image_filename: The filename of the image.
        :returns: The path of the image file.

        """

        return os.path.join(self.blocks_path, str(image_id), image_filename)

    def getImageRelativePath(self, image_id: int, image_filename: str):
        """Gets the relative path of an image.

        :param image_id: The id of the image.
        :param image_filename: The filename of the image.
        :returns: The path of the image file.

        """

        return os.path.relpath(self.getImagePath(image_id, image_filename), self.blocks_path)

    def saveFile(self, file_data: 'bytes', path: str, filename: str, owner_group_id: int) -> str:
        """Saves a file to the database.

        :param file_data: The  data.
        :param path: path for the file
        :param filename: The filename
        :param owner_group_id: The owner group of the file.
        :returns: the relative path of the form 'path/file_id/filename'.

        """

        # TODO: Check that the file extension is allowed.
        # TODO: Use imghdr module to do basic validation of the file contents.
        # TODO: Should file name be unique among images?
        cursor = self.db.cursor()
        file_id, file_path = self.get_file_path(path, filename)
        cursor.execute('INSERT INTO Block (description, UserGroup_id, type_id) VALUES (%s,%s,%s)',
                       [file_path, owner_group_id, blocktypes.IMAGE])

        with open(file_path, 'wb') as f:
            f.write(file_data)

        self.db.commit()
        return file_path

    def saveImage(self, image_data: 'bytes', image_filename: str, owner_group_id: int) -> Tuple[int, str]:
        """Saves an image to the database.

        :param image_data: The image data.
        :param image_filename: The filename of the image.
        :param owner_group_id: The owner group of the image.
        :returns: A tuple containing the id of the image and its relative path of the form 'image_id/image_filename'.

        """

        # TODO: Check that the file extension is allowed.
        # TODO: Use imghdr module to do basic validation of the file contents.
        # TODO: Should file name be unique among images?
        img_id = insert_block(image_filename, owner_group_id, blocktypes.IMAGE).id
        img_path = self.getImagePath(img_id, image_filename)
        os.makedirs(os.path.dirname(img_path))  # TODO: Set mode.

        with open(img_path, 'wb') as f:
            f.write(image_data)

        self.session.commit()
        return img_id, image_filename

    def deleteImage(self, image_id: int):
        """Deletes an image from the database."""

        cursor = self.db.cursor()
        cursor.execute('SELECT description FROM Block WHERE type_id = %s AND id = %s', [blocktypes.IMAGE, image_id])
        image_filename = cursor.fetchone()[0]
        cursor.execute('DELETE FROM Block WHERE type_id = %s AND id = %s', [blocktypes.IMAGE, image_id])
        if cursor.rowcount == 0:
            raise TimDbException('The image was not found.')

        img_path = self.getImagePath(image_id, image_filename)
        os.remove(img_path)
        os.rmdir(os.path.dirname(img_path))

        self.db.commit()

    def getImage(self, image_id: int, image_filename: str) -> bytes:
        """Gets the specified image.

        :param image_id: The id of the image.
        :param image_filename: The filename of the image.
        :returns: The content of the image.

        """

        with open(self.getImagePath(image_id, image_filename), 'rb') as f:
            return f.read()

    def getImages(self) -> List[dict]:
        """Gets all the images.

        :returns: A list of dictionaries of the form {'id': xx, 'file': 'xx/filename.ext'}.

        """

        cursor = self.db.cursor()
        cursor.execute('SELECT id, id || \'/\' || description AS file FROM Block WHERE type_id = %s',
                       [blocktypes.IMAGE])
        images = result_as_dict_list(cursor)
        return images

    def get_image_block(self, image_id: int, image_filename: str) -> Optional[Block]:
        """Returns whether the specified image exists.

        :param image_id: The id of the image.
        :param image_filename: The filename of the image.
        :returns: True if the image exists, false otherwise.

        """

        b: Block = Block.query.get(image_id)
        if not b:
            return None
        if b.type_id != blocktypes.IMAGE:
            return None

        if os.path.exists(self.getImagePath(image_id, image_filename)):
            return b
        return None
