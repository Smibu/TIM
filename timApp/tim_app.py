"""Creates the Flask application for TIM.

Insert only configuration-related things in this file. Do NOT define routes here.

"""
import inspect
import mimetypes
import sys
import warnings

from flask import Flask
from flask.exthook import ExtDeprecationWarning
from flask_migrate import Migrate
from sqlalchemy.sql.ddl import CreateTable

from timApp.documentmodel.timjsonencoder import TimJsonEncoder
from timApp.filters import map_format, timdate, humanize_timedelta, humanize_datetime
from timApp.logger import setup_logging
# noinspection PyUnresolvedReferences
from timApp.timdb.tim_models import db

# We want to import all database models here to make sure e.g. Flask-Migrate is aware of them

# noinspection PyUnresolvedReferences
from timApp.timdb.models.printeddoc import PrintedDoc
# noinspection PyUnresolvedReferences
from timApp.timdb.gamification_models.docgamified import DocGamified
# noinspection PyUnresolvedReferences
from timApp.timdb.gamification_models.documentgamificationpoint import DocumentGamificationPoint
# noinspection PyUnresolvedReferences
from timApp.timdb.gamification_models.gamificationdocument import GamificationDocument
# noinspection PyUnresolvedReferences
from timApp.timdb.gamification_models.gamificationdocumenttype import GamificationDocumentType
# noinspection PyUnresolvedReferences
from timApp.timdb.gamification_models.gamificationpointtype import GamificationPointType
# noinspection PyUnresolvedReferences
from timApp.timdb.gamification_models.usergamification import UserGamification
# noinspection PyUnresolvedReferences
from timApp.timdb.models.translation import Translation
# noinspection PyUnresolvedReferences
from timApp.timdb.models.user import User
# noinspection PyUnresolvedReferences
from timApp.timdb.models.block import Block
# noinspection PyUnresolvedReferences
from timApp.timdb.models.docentry import DocEntry
# noinspection PyUnresolvedReferences
from timApp.timdb.models.folder import Folder
# noinspection PyUnresolvedReferences
from timApp.timdb.models.usergroup import UserGroup
# noinspection PyUnresolvedReferences
from timApp.timdb.models.newuser import NewUser
# noinspection PyUnresolvedReferences
from timApp.timdb.velp_models import *
from timApp.utils import datestr_to_relative, date_to_relative

sys.setrecursionlimit(10000)
app = Flask(__name__)

# disable the warning message that is caused by Flask cache extension
warnings.simplefilter('ignore', ExtDeprecationWarning)

app.jinja_env.auto_reload = True  # uncomment this to autoreload templates

app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True
app.config.from_pyfile('defaultconfig.py', silent=False)
app.config.from_envvar('TIM_SETTINGS', silent=True)
setup_logging(app)
default_secret = app.config['SECRET_KEY']

# Compress(app)
db.init_app(app)
db.app = app
migrate = Migrate(app, db)

app.jinja_env.filters['map_format'] = map_format
app.jinja_env.filters['datestr_to_relative'] = datestr_to_relative
app.jinja_env.filters['date_to_relative'] = date_to_relative
app.jinja_env.filters['timdate'] = timdate
app.jinja_env.filters['timtimedelta'] = humanize_timedelta
app.jinja_env.filters['timreldatetime'] = humanize_datetime
app.jinja_env.add_extension('jinja2.ext.do')

mimetypes.add_type('text/plain', '.scss')

app.json_encoder = TimJsonEncoder


def print_schema(bind: str = 'tim_main'):
    """Prints the database schema generated by the models.

    :param bind: The bind to use. Default is tim_main.

    """
    models = inspect.getmembers(sys.modules[__name__], lambda x: inspect.isclass(x) and hasattr(x, '__table__'))
    eng = db.get_engine(app, bind)

    for _, model_class in models:
        print(CreateTable(model_class.__table__).compile(eng), end=';')
    print()
    sys.stdout.flush()


# print_schema()
