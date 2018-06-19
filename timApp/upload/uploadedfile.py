import os
from pathlib import Path
from typing import Optional, NamedTuple

from flask import current_app
from werkzeug.utils import secure_filename

from timApp.answer.answer_models import AnswerUpload
from timApp.document.docinfo import DocInfo
from timApp.item.block import insert_block, Block
from timApp.item.blocktypes import blocktypes
from timApp.item.item import ItemBase
from timApp.timdb.exceptions import TimDbException
from timApp.timdb.sqa import db
from timApp.user.user import User

DIR_MAPPING = {
    blocktypes.FILE: 'files',
    blocktypes.IMAGE: 'images',
    blocktypes.UPLOAD: 'uploads',
}


class PluginUploadInfo(NamedTuple):
    """Additional information required for saving a :class:`PluginUpload`."""
    task_id_name: str
    doc: DocInfo
    user: User


def get_storage_path(block_type):
    """Gets the storage path for the given block type.

    :param block_type: The block type.
    :return: The storage path.
    """
    return (Path(current_app.config['FILES_PATH'])
            / 'blocks'
            / DIR_MAPPING[block_type])


class UploadedFile(ItemBase):
    """A file that has been uploaded by a user.
    """

    def __init__(self, b: Block):
        self._block = b

    @staticmethod
    def find_by_id_and_type(block_id: int, block_type: int) -> Optional['UploadedFile']:
        b = Block.query.filter_by(id=block_id, type_id=block_type).first()
        if not b:
            return None
        return CLASS_MAPPING[block_type](b)

    @property
    def id(self):
        return self.block.id

    @property
    def block_type(self):
        return self.block.type_id

    @property
    def relative_filesystem_path(self):
        return Path(str(self.id)) / self.filename

    @property
    def base_path(self):
        return get_storage_path(self.block_type)

    @property
    def filesystem_path(self):
        return self.base_path / self.relative_filesystem_path

    @property
    def filename(self):
        return self.block.description

    @property
    def data(self):
        with self.filesystem_path.open(mode='rb') as f:
            return f.read()

    @classmethod
    def save_new(cls, file_data: bytes, file_filename: str, block_type: int,
                 upload_info: PluginUploadInfo = None) -> 'UploadedFile':
        if block_type not in DIR_MAPPING:
            raise TimDbException(f'Invalid block type given: {block_type}')
        secured_name = secure_filename(file_filename)
        if block_type == blocktypes.UPLOAD:
            assert upload_info
            base_path = get_storage_path(block_type)
            path = (base_path
                    / str(upload_info.doc.id)
                    / upload_info.task_id_name
                    / upload_info.user.name)
            path.mkdir(parents=True, exist_ok=True)
            file_id = len(os.listdir(path)) + 1
            path = path / str(file_id) / secured_name
            file_block = insert_block(
                block_type=block_type,
                description=path.relative_to(base_path).as_posix(),
            )
            au = AnswerUpload(block=file_block)
            db.session.add(au)
        else:
            file_block = insert_block(block_type=block_type, description=secured_name)
        f = CLASS_MAPPING[block_type](file_block)
        p = f.filesystem_path
        p.parent.mkdir(parents=True)
        with p.open(mode='wb') as fi:
            fi.write(file_data)
        return f


class PluginUpload(UploadedFile):
    """A file that is associated with an :class:`~.Answer`.
    """

    @property
    def relative_filesystem_path(self) -> Path:
        return Path(self.block.description)

    @property
    def filename(self):
        return self.relative_filesystem_path.parts[-1]


CLASS_MAPPING = {
    blocktypes.FILE: UploadedFile,
    blocktypes.IMAGE: UploadedFile,
    blocktypes.UPLOAD: PluginUpload,
}
