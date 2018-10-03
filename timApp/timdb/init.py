"""Initializes the TIM database."""

import logging
import os
import sys
import time

import flask_migrate
import sqlalchemy
import sqlalchemy.exc
from alembic.runtime.environment import EnvironmentContext
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from timApp.document.docparagraph import DocParagraph
from timApp.document.document import Document
from timApp.util.logger import log_info, enable_loggers, log_error, log_warning
from timApp.admin.migrate_to_postgre import perform_migration
from timApp.printing.documentprinter import DocumentPrinter
from timApp.tim_app import app
from timApp.document.documents import import_document_from_file
from timApp.document.docentry import DocEntry
from timApp.user.user import User
from timApp.timdb.sqa import db, get_tim_main_engine
from timApp.auth.auth_models import AccessType
from timApp.timdb.timdb import TimDb
from timApp.user.userutils import get_anon_group_id
from timApp.util.utils import EXAMPLE_DOCS_PATH


def check_db_version(_, context: MigrationContext):
    if context.get_current_revision() != context.environment_context.get_head_revision():
        enable_loggers()
        log_error('Your database is not up to date. To upgrade, run: ./run_command.sh flask db upgrade')
        sys.exit(-1)
    return []


def postgre_create_database(host, db_name):
    engine = sqlalchemy.create_engine(f"postgresql://postgres@{host}:5432/postgres")
    conn_failures = 0
    while True:
        try:
            conn = engine.connect()
            break
        except sqlalchemy.exc.OperationalError:
            conn_failures += 1
            max_failures = 10
            if conn_failures > max_failures:
                log_error(f'Failed more than {max_failures} times when trying to connect to PostgreSQL - exiting.')
                sys.exit(1)
            log_warning('Failed to connect to PostgreSQL, trying again in 1 second...')
            time.sleep(1)
    conn.execute("commit")
    try:
        conn.execute(f'create database "{db_name}"')
        return True
    except sqlalchemy.exc.ProgrammingError as e:
        if 'already exists' not in str(e):
            raise e
        return False
    finally:
        conn.close()


def database_has_tables():
    return bool(sqlalchemy.inspect(get_tim_main_engine()).get_table_names())


def initialize_database(create_docs=True):
    files_root_path = app.config['FILES_PATH']
    Document.default_files_root = files_root_path
    DocParagraph.default_files_root = files_root_path
    DocumentPrinter.default_files_root = files_root_path
    was_created = postgre_create_database(app.config['DB_HOST'], app.config['TIM_NAME'])
    log_info(f'Database {app.config["TIM_NAME"]} {"was created" if was_created else "exists"}.')
    timdb = TimDb(files_root_path=files_root_path)
    sess = timdb.session
    if database_has_tables():
        log_info('Initial data already exists, skipping DB initialization.')
    else:
        db.create_all()
        old_db = app.config['OLD_SQLITE_DATABASE']
        if old_db and os.path.exists(old_db):
            perform_migration(app.config['OLD_SQLITE_DATABASE'], app.config['DATABASE'])
            timdb.close()
            return
        if not app.config['TESTING']:
            with app.app_context():
                flask_migrate.stamp()
        # Alembic disables loggers for some reason
        enable_loggers()
        sess.add(AccessType(id=1, name='view'))
        sess.add(AccessType(id=2, name='edit'))
        sess.add(AccessType(id=3, name='teacher'))
        sess.add(AccessType(id=4, name='manage'))
        sess.add(AccessType(id=5, name='see answers'))
        sess.add(AccessType(id=6, name='owner'))

        timdb.users.create_special_usergroups()
        anon_group = get_anon_group_id()
        precomputed_hashes = [
            '$2b$04$zXpqPI7SNOWkbmYKb6QK9ePEUe.0pxZRctLybWNE1nxw0/WMiYlPu',  # test1pass
            '$2b$04$B0mE/VeD5Uzucfa2juzY5.8aObzCqQSDVK//bxdiQ5Ayv59PwWsVq',  # test2pass
            '$2b$04$ajl88D949ur6IF0OE7ZU2OLojkZiOwU5JtUkGTcBnwUi6W7ZIfXPe',  # test3pass
        ]
        for i in range(1, 4):
            u, _ = User.create_with_group(f'testuser{i}',
                                          f'Test user {i}',
                                          f'test{i}@example.com')
            u.pass_ = precomputed_hashes[i - 1]
        if create_docs:
            DocEntry.create('testaus-1', anon_group, title='Testaus 1')
            DocEntry.create('testaus-2', anon_group, title='Testaus 2')
            import_document_from_file(f'{EXAMPLE_DOCS_PATH}/programming_examples.md',
                                                      'programming-examples',
                                                      anon_group,
                                                      title='Programming examples')
            import_document_from_file(f'{EXAMPLE_DOCS_PATH}/mmcq_example.md',
                                                      'mmcq-example',
                                                      anon_group,
                                                      title='Multiple choice plugin example')
        sess.commit()
        log_info('Database initialization done.')

    if not app.config['TESTING']:
        exit_if_not_db_up_to_date()
    timdb.close()


def exit_if_not_db_up_to_date():
    with app.app_context():
        config = app.extensions['migrate'].migrate.get_config(None)
        script = ScriptDirectory.from_config(config)
        env = EnvironmentContext(config, script, fn=check_db_version)
        prev_level = logging.getLogger('alembic').level
        logging.getLogger('alembic').level = logging.WARN
        with env:
            script.run_env()
        logging.getLogger('alembic').level = prev_level
        enable_loggers()


if __name__ == "__main__":
    initialize_database()
