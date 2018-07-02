"""
Contains course related routes.
"""

from flask import Blueprint, abort
from sqlalchemy import any_
from sqlalchemy.orm import joinedload

from timApp.auth.sessioninfo import get_current_user_object
from timApp.bookmark.bookmarks import Bookmarks
from timApp.document.docentry import DocEntry, get_documents

from timApp.item.block import Block
from timApp.util.flask.responsehelper import json_response

course_blueprint = Blueprint('course',
                             __name__,
                             url_prefix='/courses')


@course_blueprint.route("/settings")
def get_course_settings():
    """
    Get course settings from the designated settings document.
    :return: Settings from the course settings.
    """
    d = DocEntry.find_by_path("settings/courses")
    if not d:
        return json_response({})
    return json_response(d.document.get_settings().get_dict().values)


@course_blueprint.route("/documents/<string:foldername>")
def get_documents_from_bookmark_folder(foldername):
    """
    Gets documents and their tags based on a bookmark folder name.
    :param foldername:
    :return:
    """
    folder = {}
    paths = []
    docs = []
    bookmark_folders = Bookmarks(get_current_user_object())
    for bookmark_folder in bookmark_folders.as_dict():
        if bookmark_folder['name'] == foldername:
            folder = bookmark_folder
    if folder:
        for bookmark in folder['items']:
            paths.append(bookmark['link'].replace("/view/", ""))
    else:
        # return abort(404, f"Folder {foldername} not found")
        return json_response({})

    docs = get_documents(filter_user=get_current_user_object(),
                         custom_filter=DocEntry.name.like(any_(paths)),
                         query_options=joinedload(DocEntry._block).joinedload(Block.tags))
    return json_response(docs)
