import logging
import os
from datetime import timedelta

ALLOWED_DOCUMENT_UPLOAD_MIMETYPES = ['text/plain']
COMPRESS_DEBUG     = True
COMPRESS_MIMETYPES = ['text/html', 'text/css', 'text/xml', 'application/json', 'application/javascript']
COMPRESS_MIN_SIZE  = 50
DEBUG              = False
FILES_PATH         = 'tim_files'
LOG_DIR            = "../tim_logs/"
LOG_FILE           = "timLog.log"
LOG_LEVEL          = logging.INFO
LOG_LEVEL_STDOUT   = logging.INFO
LOG_PATH           = os.path.join(LOG_DIR, LOG_FILE)
MAX_CONTENT_LENGTH = 50 * 1024 * 1024
PROFILE            = False
SECRET_KEY         = '85db8764yhfZz7-U.-y968buyn89b54y8y45tg'
SECRET_FILE_PATH   = './tim_secret.py'
PERMANENT_SESSION_LIFETIME = timedelta(days=14)
SQLALCHEMY_TRACK_MODIFICATIONS = False
IMMEDIATE_PRELOAD  = False
LIBSASS_STYLE      = "compressed"
LIBSASS_INCLUDES   = ["static/scripts/bower_components/bootstrap-sass/assets/stylesheets",
                      "static/scripts/bower_components/jquery-ui/themes/base",
                      "static"]
TIM_NAME = os.environ.get('TIM_NAME', 'timlocal')
TIM_HOST = os.environ.get('TIM_HOST', 'http://localhost')
OLD_SQLITE_DATABASE       = 'tim_files/tim.db'
DATABASE           = "postgresql://postgres@postgresql-{0}:5432/{0}".format(TIM_NAME)
SQLALCHEMY_BINDS = {
    'tim_main': DATABASE,
    'tempdb': "postgresql://postgres:postgres@postgresql-tempdb-{0}:5432/tempdb_{0}".format(TIM_NAME)
}
SASS_GEN_PATH = 'gen'
TEMPLATES_AUTO_RELOAD = True
SQLALCHEMY_DATABASE_URI = DATABASE
SQLALCHEMY_POOL_SIZE = 2
SQLALCHEMY_POOL_TIMEOUT = 120
SQLALCHEMY_MAX_OVERFLOW = 1
LAST_EDITED_BOOKMARK_LIMIT = 15
PLUGIN_COUNT_LAZY_LIMIT = 20
UPLOADER_NGINX_URL = TIM_HOST + ":41419/"
UPLOADER_CONTAINER_URL = "http://uploader:41419/"

# When enabled, the readingtypes on_screen and hover_par will not be saved in the database.
DISABLE_AUTOMATIC_READINGS = False
