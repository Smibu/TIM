import csv
import json
from io import StringIO
from urllib.parse import urlparse, urljoin

from flask import request, redirect, url_for, Response, stream_with_context

from timApp.document.timjsonencoder import TimJsonEncoder
from timApp.timdb.sqa import db


def is_safe_url(url):
    host_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, url))
    return test_url.scheme in ['http', 'https'] and \
        host_url.netloc == test_url.netloc


def safe_redirect(url, **values):
    if is_safe_url(url):
        return redirect(url, **values)
    return redirect(url_for('indexPage'))


def json_response(jsondata, status_code=200):
    response = Response(to_json_str(jsondata), mimetype='application/json')
    response.status_code = status_code
    return response


def json_response_and_commit(jsondata, status_code=200):
    db.session.commit()
    return json_response(jsondata, status_code)


def text_response(data, status_code=200):
    response = Response(data, mimetype='text/plain')
    response.status_code = status_code
    return response


def to_json_str(jsondata):
    return json.dumps(jsondata,
                      separators=(',', ':'),
                      cls=TimJsonEncoder)


def set_no_cache_headers(response: Response) -> Response:
    """Sets headers for the response that should prevent any caching of the result.

    :param response: Response to be modified.
    :return: We also return the modified object for convenience.

    """
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return response


def ok_response():
    return json_response({'status': 'ok'})


def empty_response():
    return json_response({'empty': True})


def iter_csv(data, dialect: str):
    line = StringIO()
    try:
        writer = csv.writer(line, dialect=dialect)
    except csv.Error:
        writer = csv.writer(line)
    for csv_line in data:
        writer.writerow(csv_line)
        line.seek(0)
        yield line.read()
        line.truncate(0)
        line.seek(0)


def csv_response(data, dialect='excel'):
    return Response(stream_with_context(iter_csv(data, dialect)), mimetype='text/plain')
