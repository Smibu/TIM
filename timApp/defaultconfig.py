import logging
import os
import subprocess
from datetime import timedelta

from celery.schedules import crontab

ALLOWED_DOCUMENT_UPLOAD_MIMETYPES = ['text/plain']
COMPRESS_DEBUG = True
COMPRESS_MIMETYPES = ['text/html', 'text/css', 'text/xml', 'application/json', 'application/javascript']
COMPRESS_MIN_SIZE = 50
DEBUG = False
FILES_PATH = '/tim_files'
LOG_DIR = "../tim_logs/"
LOG_FILE = "timLog.log"
LOG_LEVEL = logging.INFO
LOG_LEVEL_STDOUT = logging.INFO
LOG_PATH = os.path.join(LOG_DIR, LOG_FILE)
MAX_CONTENT_LENGTH = 50 * 1024 * 1024
PROFILE = False
SECRET_KEY = '85db8764yhfZz7-U.-y968buyn89b54y8y45tg'
SECRET_FILE_PATH = './tim_secret.py'
PERMANENT_SESSION_LIFETIME = timedelta(days=14)
SQLALCHEMY_TRACK_MODIFICATIONS = False
IMMEDIATE_PRELOAD = False
LIBSASS_STYLE = "compressed"
LIBSASS_INCLUDES = ["static/scripts/jspm_packages/github/twbs/bootstrap-sass@3.3.7/assets/stylesheets",
                    "static/scripts/jspm_packages/npm/eonasdan-bootstrap-datetimepicker@4.17.47/src/sass",
                    "static"]
TIM_NAME = os.environ.get('COMPOSE_PROJECT_NAME', 'tim')
TIM_HOST = os.environ.get('TIM_HOST', 'http://localhost')
OLD_SQLITE_DATABASE = '/tim_files/tim.db'
DB_HOST = 'postgresql'
DATABASE = f"postgresql://postgres@{DB_HOST}:5432/{TIM_NAME}"
SASS_GEN_PATH = 'gen'
TEMPLATES_AUTO_RELOAD = True
SQLALCHEMY_DATABASE_URI = DATABASE
SQLALCHEMY_POOL_SIZE = 2
SQLALCHEMY_POOL_TIMEOUT = 15
SQLALCHEMY_MAX_OVERFLOW = 100
LAST_EDITED_BOOKMARK_LIMIT = 15
LAST_READ_BOOKMARK_LIMIT = 15
PLUGIN_COUNT_LAZY_LIMIT = 20
UPLOADER_NGINX_URL = TIM_HOST + ":41419/"
UPLOADER_CONTAINER_URL = "http://uploader:41419/"

# When enabled, the readingtypes on_screen and hover_par will not be saved in the database.
DISABLE_AUTOMATIC_READINGS = False
HELP_EMAIL = 'tim@jyu.fi'
ERROR_EMAIL = 'timwuff.group@korppi.jyu.fi'
WUFF_EMAIL = 'wuff@tim.jyu.fi'
KORPPI_AUTHORIZE_URL = "https://korppi.jyu.fi/kotka/interface/allowRemoteLogin.jsp"
GLOBAL_NOTIFICATION_FILE = '/tmp/global_notification.html'

QST_PLUGIN_PORT = 5000
GIT_LATEST_COMMIT_TIMESTAMP = subprocess.run(["git", "log", "-1", "--date=format:%d.%m.%Y %H:%M:%S", "--format=%cd"],
                                             stdout=subprocess.PIPE).stdout.decode().strip()
GIT_BRANCH = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], stdout=subprocess.PIPE).stdout.decode().strip()
OPENID_IDENTITY_URL = 'https://korppi.jyu.fi/openid'

CELERY_BROKER_URL = 'redis://redis:6379',
CELERY_RESULT_BACKEND = 'redis://redis:6379'
CELERY_IMPORTS = ('timApp.tim_celery',)
CELERYBEAT_SCHEDULE = {
    'update-search-files': {
        'task': 'timApp.tim_celery.update_search_files',
        'schedule': crontab(minute='*/15'),  # Repeat every quarter hour.
    },
    'process-notifications': {
        'task': 'timApp.tim_celery.process_notifications',
        'schedule': crontab(minute='*/2'),
    }
}
MAIL_HOST = "smtp.jyu.fi"
MAIL_SIGNATURE = "\n\n-- \nThis message was automatically sent by TIM"
