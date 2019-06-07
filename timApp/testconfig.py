import logging
import os
from datetime import timedelta

from timApp.util.utils import pycharm_running

DEBUG = True
PROFILE = False
TIM_NAME = 'tim-test'
DB_HOST = 'postgresql-test'
DATABASE = f"postgresql://postgres@{DB_HOST}:5432/{TIM_NAME}"
FILES_PATH = '/tmp/doctest_files'
LOG_DIR = "/tmp/tim_logs"
LOG_FILE = "timLog.log"
LOG_LEVEL = logging.ERROR
LOG_LEVEL_STDOUT = logging.ERROR
LOG_PATH = os.path.join(LOG_DIR, LOG_FILE)
TESTING = True
OLD_SQLITE_DATABASE = None
SQLALCHEMY_DATABASE_URI = DATABASE

# Webassets seems to have a weird bug that it cannot find the cache files if the paths are not default,
# so we cannot modify them. And without the cache, running the tests is twice as slow.
# ASSETS_DIRECTORY = '/tmp/doctest_files'
# ASSETS_CACHE = '.webassets-cache'

SQLALCHEMY_POOL_SIZE = 50
LAST_EDITED_BOOKMARK_LIMIT = 3
TRAP_HTTP_EXCEPTIONS = True
PROPAGATE_EXCEPTIONS = True
SELENIUM_REMOTE_URL = os.environ.get('SELENIUM_REMOTE_URL', 'http://chrome')
SELENIUM_BROWSER_URL = os.environ.get('SELENIUM_BROWSER_URL', 'http://nginx:' +
                                      ('81' if pycharm_running() else '82'))
LIVESERVER_PORT = 5001
QST_PLUGIN_PORT = LIVESERVER_PORT
PERMANENT_SESSION_LIFETIME = timedelta(weeks=9999)

CELERYBEAT_SCHEDULE = {
    # don't schedule anything while testing
}
WTF_CSRF_METHODS = []
SCIM_USERNAME = 't'
SCIM_PASSWORD = 'pass'
