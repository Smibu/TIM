import glob
import os
import unittest
from typing import Union, List

import sqlalchemy.exc
from sqlalchemy.orm import close_all_sessions

import timApp.markdown.dumboclient
import timApp.timdb.init
from timApp.document.docentry import DocEntry
from timApp.document.docinfo import DocInfo
from timApp.document.document import Document
from timApp.tim_app import app
from timApp.timdb.sqa import db
from timApp.timdb.timdb import TimDb
from timApp.user.user import User
from timApp.util.filemodehelper import change_permission_and_retry
from timApp.util.utils import del_content, remove_prefix


class TimDbTest(unittest.TestCase):
    test_files_path = '/tmp/doctest_files'
    db_path = app.config['DATABASE']
    i = 0
    create_docs = False

    def get_db(self):
        return self.db

    @classmethod
    def setUpClass(cls):
        if os.path.exists(cls.test_files_path):
            # Safety mechanism
            assert cls.test_files_path != '/tim_files'
            del_content(cls.test_files_path, onerror=change_permission_and_retry)
            for f in glob.glob('/tmp/heading_cache_*'):
                os.remove(f)
            for f in glob.glob('/tmp/tim_auto_macros_*'):
                os.remove(f)
        else:
            os.mkdir(cls.test_files_path)
        # Safety mechanism to make sure we are not wiping some production database
        assert app.config['SQLALCHEMY_DATABASE_URI'].endswith('-test')
        # The following throws if the testing database has not been created yet; we can safely ignore it
        try:
            db.drop_all()
        except sqlalchemy.exc.OperationalError:
            pass
        timApp.timdb.init.initialize_database(create_docs=cls.create_docs)

    def setUp(self):
        if running_in_gitlab() and remove_prefix(self.id(), 'timApp.') in GITLAB_SKIP_TESTS:
            self.skipTest('This test fails in GitLab')
        self.db = TimDb(files_root_path=self.test_files_path)

    def tearDown(self):
        close_all_sessions()
        self.db.close()

    def create_doc(self, from_file=None, initial_par: Union[str, List[str]]=None, settings=None) -> DocInfo:
        d = DocEntry.create(f'test{TimDbTest.i}', 0, 'test', from_file=from_file, initial_par=initial_par,
                            settings=settings)
        TimDbTest.i += 1
        return d

    def init_doc(self, doc: Document, from_file, initial_par: Union[str, List[str]], settings):
        if from_file is not None:
            with open(from_file, encoding='utf-8') as f:
                doc.add_text(f.read())
        elif initial_par is not None:
            if isinstance(initial_par, str):
                doc.add_text(initial_par)
            elif isinstance(initial_par, list):
                for p in initial_par:
                    doc.add_text(p)
        if settings is not None:
            doc.set_settings(settings)

    @property
    def test_user_1(self) -> User:
        return User.get_by_name('testuser1')

    @property
    def test_user_2(self) -> User:
        return User.get_by_name('testuser2')

    @property
    def test_user_3(self) -> User:
        return User.get_by_name('testuser3')

    def get_test_user_1_group_id(self):
        return 6

    def get_test_user_2_group_id(self):
        return 7

    def assert_dict_subset(self, data, subset):
        for k, v in subset.items():
            self.assertEqual(v, data[k], msg=f'Key {k} was different')

    def assert_list_of_dicts_subset(self, datalist, subsetlist):
        for d, s in zip(datalist, subsetlist):
            self.assert_dict_subset(d, s)


TEST_USER_1_ID = 2
TEST_USER_2_ID = 3
TEST_USER_3_ID = 4

TEST_USER_1_NAME = 'Test user 1'
TEST_USER_2_NAME = 'Test user 2'
TEST_USER_3_NAME = 'Test user 3'

TEST_USER_1_USERNAME = 'testuser1'
TEST_USER_2_USERNAME = 'testuser2'
TEST_USER_3_USERNAME = 'testuser3'


GITLAB_SKIP_TESTS = {
}


def running_in_gitlab():
    return os.environ.get('GITLAB_CI') == 'true'
