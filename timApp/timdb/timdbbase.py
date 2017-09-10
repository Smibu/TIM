""""""
import decimal
import os
from datetime import datetime, timezone
from typing import Iterable
from typing import Optional, Tuple

from psycopg2._psycopg import connection
from sqlalchemy.orm import scoped_session

from timApp.timdb.accesstype import AccessType
from timApp.timdb.models.block import Block
from timApp.timdb.tim_models import BlockAccess, db
from timApp.utils import split_location, join_location, get_sql_template


class TimDbBase(object):
    """Base class for TimDb classes (e.g. Users, Notes).

    :type db: connection
    :type files_root_path: str
    :type current_user_name: str
    :type blocks_path: str

    """

    def __init__(self, db: connection, files_root_path: str, type_name: str, current_user_name: str, session: scoped_session):
        """Initializes TimDB with the specified database and root path.

        :param db: The database connection.
        :param files_root_path: The root path where all the files will be stored.
        :param type_name: The type name.
        :param current_user_name: The current user name.

        """
        self.files_root_path = os.path.abspath(files_root_path)
        self.current_user_name = current_user_name

        self.blocks_path = os.path.join(self.files_root_path, 'blocks', type_name)
        for path in [self.blocks_path]:
            if not os.path.exists(path):
                os.makedirs(path)
        self.db = db
        self.session = session

    def get_sql_template(self, value_list: list):
        return get_sql_template(value_list)

    def getBlockPath(self, block_id: int) -> str:
        """Gets the path of the specified block.

        :param block_id: The id of the block.
        :returns: The path of the block.

        """
        return os.path.join(self.blocks_path, str(block_id))

    def blockExists(self, block_id: int, block_type: int, check_file: bool = True) -> bool:
        """Checks whether the specified block exists.

        :param block_id: The id of the block to check.
        :param block_type: The type of the block to check.
        :returns: True if the block exists, false otherwise.

        """

        cursor = self.db.cursor()
        try:
            cursor.execute('SELECT exists(SELECT id FROM Block WHERE id = %s AND type_id = %s LIMIT 1)',
                           [block_id, block_type])
        except OverflowError:
            return False
        result = cursor.fetchone()
        return result[0] == 1

    def get_owner(self, block_id: int) -> Optional[int]:
        """Returns the owner group for a block.

        :param block_id: The id of the block.

        """
        return Block.query.get(block_id).owner.id

    def set_owner(self, block_id: int, usergroup_id: int):
        """Changes the owner group for a block.

        :param block_id: The id of the block.
        :param usergroup_id: The id of the new usergroup.

        """
        BlockAccess.query.filter_by(block_id=block_id, type=AccessType.owner.value).delete()
        b = BlockAccess(block_id=block_id,
                        usergroup_id=usergroup_id,
                        type=AccessType.owner.value,
                        accessible_from=datetime.now(tz=timezone.utc))
        db.session.add(b)
        db.session.commit()

    def resultAsDictionary(self, cursor):
        """Converts the result in database cursor object to JSON."""

        rows = [x for x in cursor.fetchall()]
        cols = [x[0] for x in cursor.description]
        results = []
        for row in rows:
            result = {}
            for prop, val in zip(cols, row):
                if isinstance(val, decimal.Decimal):
                    val = float(val)
                result[prop] = val
            results.append(result)
        return results

    def resultAsList(self, cursor):
        """Converts the result in database cursor object to JSON."""

        rows = [x for x in cursor.fetchall()]
        cols = [x[0] for x in cursor.description]
        results = []
        for row in rows:
            results.append(str(row[0]))
        return results

    @classmethod
    def split_location(cls, path: str) -> Tuple[str, str]:
        """Given a path 'a/b/c/d', returns a tuple ('a/b/c', 'd')."""
        return split_location(path)

    @classmethod
    def join_location(cls, location: str, name: str) -> str:
        return join_location(location, name)

    def get_id_filter(self, filter_ids: Iterable[int]):
        return ' AND id IN ({})'.format(','.join(str(x) for x in filter_ids))
