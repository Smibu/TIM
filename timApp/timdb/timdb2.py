"""
Defines the TimDb database class.
"""
import os
import time
from time import sleep

from routes.logger import log_info, log_debug, log_error, log_warning
from timdb.annotations import Annotations
from timdb.answers import Answers
from timdb.documents import Documents
from timdb.files import Files
from timdb.folders import Folders
from timdb.images import Images
from timdb.lectureanswers import LectureAnswers
from timdb.lectures import Lectures
from timdb.messages import Messages
from timdb.notes import Notes
from timdb.questions import Questions
from timdb.readings import Readings
from timdb.tim_models import Version, db
from timdb.uploads import Uploads
from timdb.users import Users
from timdb.velpgroups import VelpGroups
from timdb.velps import Velps


num = 0

# The following will be set (before request) by gunicorn; see gunicornconf.py. Always 0 if running without gunicorn.
worker_pid = 0

DB_PART_NAMES = {'notes', 'readings', 'users', 'images', 'uploads', 'files', 'documents', 'answers', 'questions',
                 'messages', 'lectures', 'folders', 'lecture_answers', 'velps', 'velp_groups', 'annotations', 'session'}

class TimDb(object):
    instances = 0
    """Handles saving and retrieving information from TIM database.
    """

    def __init__(self, files_root_path: str,
                 current_user_name: str = 'Anonymous',
                 route_path: str = ''):
        """Initializes TimDB with the specified files root path, SQLAlchemy session and user name.
        
        created.
        :param current_user_name: The username of the current user.
        :param files_root_path: The root path where all the files will be stored.
        :param route_path: Path for the route requesting the db
        """
        self.files_root_path = os.path.abspath(files_root_path)
        self.route_path = route_path
        self.current_user_name = current_user_name
        
        self.blocks_path = os.path.join(self.files_root_path, 'blocks')
        for path in [self.blocks_path]:
            if not os.path.exists(path):
                log_info('Creating directory: {}'.format(path))
                os.makedirs(path)
        self.reset_attrs()

    def reset_attrs(self):
        self.num = 0
        self.time = 0
        self.engine = None
        self.db = None
        self.notes = None
        self.readings = None
        self.users = None
        self.images = None
        self.uploads = None
        self.files = None
        self.documents = None
        self.answers = None
        self.questions = None
        self.messages = None
        self.lectures = None
        self.folders = None
        self.lecture_answers = None
        self.velps = None
        self.velp_groups = None
        self.annotations = None

    def __getattribute__(self, item):
        """Used to open TimDb connection lazily."""
        if item in DB_PART_NAMES and self.db is None:
            self.open()
        return object.__getattribute__(self, item)

    def open(self):
        global num
        num += 1
        self.num = num
        self.time = time.time()
        log_debug(  "GetDb      {:2d} {:6d} {:2s} {:3s} {:7s} {:s}".format(worker_pid,self.num,"","","",self.route_path))
        # log_info('TimDb-dstr {:2d} {:6d} {:2d} {:3d} {:7.5f} {:s}'.format(worker_pid,self.num, TimDb.instances, bes, time.time() - self.time, self.route_path))
        waiting = False
        from tim_app import app
        while True:
            try:
                self.engine = db.get_engine(app, 'tim_main')
                self.db = self.engine.connect().connection
                self.session = db.session
                break
            except Exception as err:
                if not waiting: log_warning("WaitDb " + str(self.num) + " " + str(err))
                waiting = True
                sleep(0.1)

        if waiting: log_warning("ReadyDb " + str(self.num))

        TimDb.instances += 1
        # num_connections = self.get_pg_connections()
        # log_info('TimDb instances/PG connections: {}/{} (constructor)'.format(TimDb.instances, num_connections))
        self.notes = Notes(self.db, self.files_root_path, 'notes', self.current_user_name, self.session)
        self.readings = Readings(self.db, self.files_root_path, 'notes', self.current_user_name, self.session)
        self.users = Users(self.db, self.files_root_path, 'users', self.current_user_name, self.session)
        self.images = Images(self.db, self.files_root_path, 'images', self.current_user_name, self.session)
        self.uploads = Uploads(self.db, self.files_root_path, 'uploads', self.current_user_name, self.session)
        self.files = Files(self.db, self.files_root_path, 'files', self.current_user_name, self.session)
        self.documents = Documents(self.db, self.files_root_path, 'documents', self.current_user_name, self.session)
        self.answers = Answers(self.db, self.files_root_path, 'answers', self.current_user_name, self.session)
        self.questions = Questions(self.db, self.files_root_path, 'questions', self.current_user_name, self.session)
        self.messages = Messages(self.db, self.files_root_path, 'messages', self.current_user_name, self.session)
        self.lectures = Lectures(self.db, self.files_root_path, 'lectures', self.current_user_name, self.session)
        self.folders = Folders(self.db, self.files_root_path, 'folders', self.current_user_name, self.session)
        self.lecture_answers = LectureAnswers(self.db, self.files_root_path, 'lecture_answers', self.current_user_name, self.session)
        self.velps = Velps(self.db, self.files_root_path, 'velps', self.current_user_name, self.session)
        self.velp_groups = VelpGroups(self.db, self.files_root_path, 'velp_groups', self.current_user_name, self.session)
        self.annotations = Annotations(self.db, self.files_root_path, 'annotations', self.current_user_name, self.session)

    def get_pg_connections(self):
        """Returns the number of clients currently connected to PostgreSQL."""
        cursor = self.db.cursor()
        cursor.execute('SELECT sum(numbackends) FROM pg_stat_database')
        num_connections = cursor.fetchone()[0]
        return num_connections

    def __del__(self):
        """Release the database connection when the object is deleted."""
        self.close()

    def commit(self):
        """Commits any changes to the database."""
        db.session.commit()
        self.db.commit()

    def close(self):
        """Closes the database connection."""
        if hasattr(self, 'db') and self.db is not None:
            bes = -1
            TimDb.instances -= 1
            try:
                # bes = self.get_pg_connections()
                self.db.close()
            except Exception as err:
                log_error('close error: ' + str(self.num) + ' ' + str(err))

            log_debug('TimDb-dstr {:2d} {:6d} {:2d} {:3d} {:7.5f} {:s}'.format(worker_pid, self.num, TimDb.instances , bes,  time.time() - self.time, self.route_path ))
            self.reset_attrs()

    def execute_script(self, sql_file):
        """Executes an SQL file on the database.
        :param sql_file: The SQL script to be executed.
        """
        with open(sql_file, 'r', encoding='utf-8') as schema_file:
            self.db.cursor().executescript(schema_file.read())
        self.db.commit()

    def execute_sql(self, sql):
        """Executes an SQL command on the database.
        :param sql: The SQL command to be executed.
        """
        self.db.cursor().executescript(sql)
        self.db.commit()

    def get_version(self) -> int:
        """Gets the current database version.
        :return: The database version as an integer.
        """
        ver = self.session.query(db.func.max(Version.id)).scalar()
        assert isinstance(ver, int)
        return ver

    def update_version(self):
        """Updates the database version by inserting a new sequential entry in the Version table.
        """
        c = self.db.cursor()
        c.execute("""INSERT INTO Version(updated_on) VALUES (CURRENT_TIMESTAMP)""")
        self.db.commit()

    def table_exists(self, table_name):
        """Checks whether a table with the specified name exists in the database.
        """
        c = self.db.cursor()
        c.execute("SELECT EXISTS(SELECT * FROM information_schema.tables WHERE table_name = %s)", (table_name,))
        return c.fetchone()[0]
