"""Defines the TimRouteTest class."""
import base64
import io
import json
import re
import socket
import unittest
import warnings
from functools import lru_cache
from typing import Union, Optional, List, Dict, Tuple, Any

from flask import Response
from flask import session
from flask.testing import FlaskClient
from lxml import html
from lxml.html import HtmlElement

import timApp.tim
from timApp.document.docparagraph import DocParagraph
from timApp.document.document import Document
from timApp.document.specialnames import TEMPLATE_FOLDER_NAME, PREAMBLE_FOLDER_NAME
from timApp.document.timjsonencoder import TimJsonEncoder
from timApp.auth.login import log_in_as_anonymous
from timApp.readmark.readparagraphtype import ReadParagraphType
from timApp.tests.db.timdbtest import TimDbTest
from timApp.document.docinfo import DocInfo
from timApp.document.docentry import DocEntry
from timApp.document.translation.translation import Translation
from timApp.user.user import User
from timApp.user.usergroup import UserGroup
from timApp.util.utils import remove_prefix
from timApp.timdb.sqa import db


def load_json(resp: Response):
    return json.loads(resp.get_data(as_text=True))


def is_redirect(response: Response):
    return response.status_code in (302, 303)


orig_getaddrinfo = socket.getaddrinfo

TEXTUAL_MIMETYPES = {'text/html', 'application/json', 'text/plain'}
LOCALHOST = 'http://localhost/'


# noinspection PyIncorrectDocstring
@lru_cache(maxsize=100)
def fast_getaddrinfo(host, port, family=0, addrtype=0, proto=0, flags=0):
    """On Windows/Boot2docker, the getaddrinfo function is really slow, so we wrap the function and cache the result."""
    return orig_getaddrinfo(host, port, family, addrtype, proto, flags)


socket.getaddrinfo = fast_getaddrinfo

testclient: FlaskClient = timApp.tim.app.test_client()
testclient = testclient.__enter__()


def get_content(element: HtmlElement, selector: str = '.parContent') -> List[str]:
    return [r.text_content().strip() for r in element.cssselect(selector)]


class TimRouteTest(TimDbTest):
    """A base class for running tests for TIM routes."""
    doc_num = 1

    # The expected content of an AJAX response that does not return any specific information.
    ok_resp = {'status': 'ok'}

    # The expected content of an AJAX response that returns a generic permission error.
    permission_error = {'error': "Sorry, you don't have permission to view this resource."}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.client = testclient

    def get(self,
            url: str,
            as_tree: bool = False,
            expect_status: Optional[int] = 200,
            expect_content: Union[None, str, Dict, List] = None,
            expect_contains: Union[None, str, List[str], Dict] = None,
            expect_xpath: Optional[str] = None,
            json_key: Optional[str] = None,
            headers: Optional[List[Tuple[str, str]]] = None,
            **kwargs):
        """Performs a GET request.

        See the 'request' method for parameter explanations.

        """
        return self.request(url,
                            'GET',
                            as_tree=as_tree,
                            expect_status=expect_status,
                            expect_content=expect_content,
                            expect_contains=expect_contains,
                            expect_xpath=expect_xpath,
                            json_key=json_key,
                            headers=headers,
                            **kwargs)

    def post(self,
             url: str,
             as_tree: bool = False,
             expect_status: Optional[int] = 200,
             expect_content: Union[None, str, Dict, List] = None,
             expect_contains: Union[None, str, List[str]] = None,
             expect_xpath: Optional[str] = None,
             json_key: Optional[str] = None,
             headers: Optional[List[Tuple[str, str]]] = None,
             **kwargs):
        """Performs a POST request.

        See the 'request' method for parameter explanations.

        """
        return self.request(url,
                            'POST',
                            as_tree=as_tree,
                            expect_status=expect_status,
                            expect_content=expect_content,
                            expect_contains=expect_contains,
                            expect_xpath=expect_xpath,
                            json_key=json_key,
                            headers=headers,
                            **kwargs)

    def delete(self,
               url: str,
               as_tree: bool = False,
               expect_status: Optional[int] = 200,
               expect_content: Union[None, str, Dict, List] = None,
               expect_contains: Union[None, str, List[str]] = None,
               expect_xpath: Optional[str] = None,
               json_key: Optional[str] = None,
               headers: Optional[List[Tuple[str, str]]] = None,
               **kwargs):
        """Performs a DELETE request.

        See the 'request' method for parameter explanations.

        """
        return self.request(url,
                            'DELETE',
                            as_tree=as_tree,
                            expect_status=expect_status,
                            expect_content=expect_content,
                            expect_contains=expect_contains,
                            expect_xpath=expect_xpath,
                            json_key=json_key,
                            headers=headers,
                            **kwargs)

    def request(self,
                url: str,
                method: str,
                as_tree: bool = False,
                expect_status: Optional[int] = 200,
                expect_content: Union[None, str, Dict, List] = None,
                expect_contains: Union[None, str, List[str]] = None,
                expect_mimetype: Optional[str] = None,
                expect_xpath: Optional[str] = None,
                json_key: Optional[str] = None,
                headers: Optional[List[Tuple[str, str]]] = None,
                xhr=True,
                **kwargs) -> Union[Response, str, Dict]:
        """Performs a request.

        For JSON POST/PUT requests, use the shortcut json_* methods.

        :param url: The request URL.
        :param method: The request method (e.g. GET, POST, PUT, DELETE).
        :param as_tree: Whether to return the response as an HTML tree.
        :param expect_status: The expected status code.
        :param expect_content: The expected response content.
         * If the response is a redirect, this parameter is interpreted as the expected redirect target URL.
         * Otherwise, if as_tree is True, this parameter is not used.
         * Otherwise, if the response mimetype is application/json, this parameter is interpreted as a dictionary or list
         that must match the response content.
         * Otherwise, this parameter is interpreted as a string that must match the response content.
        :param expect_contains: The expected subset(s) of the response content. This can be a string or a list of strings.
        :param expect_xpath: The expected XPath expression that must match at least one element in the response tree.
           This parameter can also be used for JSON responses as long as json_key is provided and the data in that key
           is HTML.
        :param json_key: The expected key that is found in the returned JSON data. Any other data is discarded.
        :param headers: Custom headers for the request.
        :param kwargs: Custom parameters to be passed to test client's 'open' method. Can be, for example,
           query_string={'a': '1', 'b': '2'} for passing URL arguments.
        :return: If as_tree is True: Returns the response as an HTML tree.
                 Otherwise, if the response mimetype is application/json, returns the response as a JSON dict or list.
                 Otherwise, returns the response as a string.

        """
        if headers is None:
            headers = []
        if xhr:
            headers.append(('X-Requested-With', 'XMLHttpRequest'))
        resp = self.client.open(url, method=method, headers=headers, **kwargs)
        is_textual = resp.mimetype in TEXTUAL_MIMETYPES
        if expect_status is not None:
            self.assertEqual(expect_status, resp.status_code, msg=resp.get_data(as_text=True) if is_textual else None)
        if expect_mimetype is not None:
            self.assertEqual(expect_mimetype, resp.mimetype)
        if is_redirect(resp) and expect_content is not None:
            self.assertEqual(expect_content, remove_prefix(resp.location, LOCALHOST))
        resp_data = resp.get_data(as_text=is_textual)
        if not is_textual:
            return resp_data
        if as_tree:
            if json_key is not None:
                resp_data = json.loads(resp_data)[json_key]
            tree = html.fromstring(resp_data)
            if expect_xpath is not None:
                self.assertLessEqual(1, len(tree.findall(expect_xpath)))
            return tree
        elif resp.mimetype == 'application/json':
            loaded = json.loads(resp_data)
            if json_key is not None:
                loaded = loaded[json_key]
            if expect_content is not None:
                self.assertEqual(expect_content, loaded)
            if expect_contains is not None:
                self.check_contains(expect_contains, loaded)
            if expect_xpath is not None:
                self.assertIsNotNone(json_key)
                self.assertLessEqual(1, len(html.fragment_fromstring(loaded, create_parent=True).findall(expect_xpath)))
            return loaded
        else:
            if expect_content is not None and not is_redirect(resp):
                self.assertEqual(expect_content, resp_data)
            elif expect_contains is not None:
                self.check_contains(expect_contains, resp_data)
            return resp_data if not is_redirect(resp) else resp.location

    def check_contains(self, expect_contains, data):
        if isinstance(expect_contains, str):
            self.assertIn(expect_contains, data)
        elif isinstance(expect_contains, list):
            for s in expect_contains:
                self.assertIn(s, data)
        elif isinstance(expect_contains, dict):
            self.assert_dict_subset(data, expect_contains)
        else:
            self.assertTrue(False, 'Unknown type for expect_contains parameter')

    def json_put(self,
                 url: str,
                 json_data: Optional[Dict] = None,
                 as_tree: bool = False,
                 expect_status: Optional[int] = 200,
                 expect_content: Union[None, str, Dict, List] = None,
                 expect_contains: Union[None, str, List[str]] = None,
                 expect_xpath: Optional[str] = None,
                 json_key: Optional[str] = None,
                 headers: Optional[List[Tuple[str, str]]] = None,
                 **kwargs):
        """Performs a JSON PUT request.

        :param url: The request URL.
        :param json_data: The JSON data to be submitted.
        :param kwargs: Any custom parameters that are accepted by the 'request' method.
        :return: See the 'request' method.

        """
        return self.json_req(url,
                             json_data,
                             'PUT',
                             as_tree=as_tree,
                             expect_status=expect_status,
                             expect_content=expect_content,
                             expect_contains=expect_contains,
                             expect_xpath=expect_xpath,
                             json_key=json_key,
                             headers=headers,
                             **kwargs)

    def json_delete(self,
                    url: str,
                    json_data: Optional[Dict] = None,
                    as_tree: bool = False,
                    expect_status: Optional[int] = 200,
                    expect_content: Union[None, str, Dict, List] = None,
                    expect_contains: Union[None, str, List[str]] = None,
                    expect_xpath: Optional[str] = None,
                    json_key: Optional[str] = None,
                    headers: Optional[List[Tuple[str, str]]] = None,
                    **kwargs):
        """Performs a JSON DELETE request.

        :param url: The request URL.
        :param json_data: The JSON data to be submitted.
        :param kwargs: Any custom parameters that are accepted by the 'request' method.
        :return: See the 'request' method.

        """
        return self.json_req(url,
                             json_data,
                             'DELETE',
                             as_tree=as_tree,
                             expect_status=expect_status,
                             expect_content=expect_content,
                             expect_contains=expect_contains,
                             expect_xpath=expect_xpath,
                             json_key=json_key,
                             headers=headers,
                             **kwargs)

    def json_post(self,
                  url: str,
                  json_data: Optional[Union[Dict, List]] = None,
                  as_tree: bool = False,
                  expect_status: Optional[int] = 200,
                  expect_content: Union[None, str, Dict, List] = None,
                  expect_contains: Union[None, str, List[str], Dict] = None,
                  expect_xpath: Optional[str] = None,
                  json_key: Optional[str] = None,
                  headers: Optional[List[Tuple[str, str]]] = None,
                  **kwargs):
        """Performs a JSON POST request.

        :param url: The request URL.
        :param json_data: The JSON data to be submitted.
        :param kwargs: Any custom parameters that are accepted by the 'request' method.
        :return: See the 'request' method.

        """
        return self.json_req(url,
                             json_data,
                             'POST',
                             as_tree=as_tree,
                             expect_status=expect_status,
                             expect_content=expect_content,
                             expect_contains=expect_contains,
                             expect_xpath=expect_xpath,
                             json_key=json_key,
                             headers=headers,
                             **kwargs)

    def json_req(self,
                 url: str,
                 json_data: Optional[Dict] = None,
                 method: str = 'GET',
                 as_tree: bool = False,
                 expect_status: Optional[int] = 200,
                 expect_content: Union[None, str, Dict, List] = None,
                 expect_contains: Union[None, str, List[str]] = None,
                 expect_xpath: Optional[str] = None,
                 json_key: Optional[str] = None,
                 headers: Optional[List[Tuple[str, str]]] = None,
                 **kwargs):
        """Performs a JSON request.

        :param url: The request URL.
        :param method: The request method.
        :param json_data: The JSON data to be submitted.
        :param kwargs: Any custom parameters that are accepted by the 'request' method.
        :return: See the 'request' method.

        """
        return self.request(url,
                            method=method,
                            data=json.dumps(json_data, cls=TimJsonEncoder),
                            content_type='application/json',
                            as_tree=as_tree,
                            expect_status=expect_status,
                            expect_content=expect_content,
                            expect_contains=expect_contains,
                            expect_xpath=expect_xpath,
                            json_key=json_key,
                            headers=headers,
                            **kwargs)

    def post_par(self, doc: Document, text: str, par_id: str, extra_data=None, **kwargs):
        """Edits a paragraph in a document.

        :param doc: The document to be edited.
        :param text: The new text for the paragraph.
        :param par_id: The id of the paragraph to be edited.
        :return: The response object.

        """
        doc.clear_mem_cache()
        if extra_data is None:
            extra_data = {}
        return self.json_post('/postParagraph/', {
            "text": text,
            "docId": doc.doc_id,
            "par": par_id,
            "par_next": None,
            **extra_data,
        }, **kwargs)

    def post_area(self, doc: DocInfo, text: str, area_start: str, area_end: str, **kwargs):
        """Edits an area in a document.

        :param doc: The document to be edited.
        :param text: The new text for the paragraph.
        :return: The response object.

        """
        doc.document.clear_mem_cache()
        return self.json_post('/postParagraph/', {
            "text": text,
            "docId": doc.id,
            "area_start": area_start,
            "area_end": area_end,
            "par": None,
            "par_next": None,
        }, **kwargs)

    def new_par(self, doc: Document, text: str, next_id: Optional[str] = None, additional_data=None, **kwargs):
        """Posts a new paragraph in a document.

        :param additional_data: Additional data to pass in newParagraph route.
        :param doc: The document to be edited.
        :param text: The text for the paragraph.
        :param next_id: The id of the paragraph following the new paragraph.
        :return: The response object.

        """
        if not additional_data:
            additional_data = {}
        doc.clear_mem_cache()
        return self.json_post('/newParagraph/', {
            "text": text,
            "docId": doc.doc_id,
            "par_next": next_id,
            **additional_data
        }, **kwargs)

    def delete_par(self, doc: DocInfo, par_id: str, **kwargs):
        doc.document.clear_mem_cache()
        return self.json_post(f'/deleteParagraph/{doc.id}', {
            "par": par_id,
        }, **kwargs)

    def delete_area(self, doc: DocInfo, area_start: str, area_end: str, **kwargs):
        doc.document.clear_mem_cache()
        return self.json_post(f'/deleteParagraph/{doc.id}', {
            "area_start": area_start,
            "area_end": area_end,
        }, **kwargs)

    def update_whole_doc(self, doc: DocInfo, text: str, **kwargs):
        doc.document.clear_mem_cache()
        return self.json_post(f'/update/{doc.id}', {'fulltext': text, 'original': doc.document.export_markdown()},
                              **kwargs)

    def post_answer(self, plugin_type, task_id, user_input,
                    save_teacher=False, teacher=False, user_id=None, answer_id=None, ref_from=None,
                    **kwargs):
        return self.json_put(f'/{plugin_type}/{task_id}/answer/',
                             {"input": user_input,
                              "ref_from": {'docId': ref_from[0], 'par': ref_from[1]} if ref_from else None,
                              "abData": {"saveTeacher": save_teacher,
                                         "teacher": teacher,
                                         "userId": user_id,
                                         "answer_id": answer_id,
                                         "saveAnswer": True}}, **kwargs)

    def post_answer_no_abdata(self, plugin_type, task_id, user_input, ref_from=None, **kwargs):
        return self.json_put(f'/{plugin_type}/{task_id}/answer/',
                             {"input": user_input,
                              "ref_from": {'docId': ref_from[0], 'par': ref_from[1]} if ref_from else None,
                              }, **kwargs)

    def get_task_answers(self, task_id):
        answer_list = self.get(f'/answers/{task_id}/{self.current_user_id()}')
        return answer_list

    @staticmethod
    def current_user_id() -> Optional[int]:
        """Returns the name of the current user.

        :return: The name of the current user.

        """
        return session.get('user_id')

    @property
    def is_logged_in(self):
        return self.current_user_id() is not None

    @property
    def current_user(self) -> Optional[User]:
        curr_id = self.current_user_id()
        return User.query.get(curr_id) if curr_id is not None else None

    def current_group(self) -> UserGroup:
        return self.current_user.get_personal_group()

    def login_anonymous(self):
        with self.client.session_transaction() as s:
            log_in_as_anonymous(s)
        self.client.session_transaction().__enter__()

    def login_test1(self, force: bool = False, add: bool = False, **kwargs):
        """Logs testuser1 in.

        :param force: Whether to force the login route to be called even if the user is already logged in.
        :param add: Whether to add this user to the session group.
        :return: Response as a JSON dict.

        """
        return self.login('test1@example.com', 'test1pass', 'testuser1', force=force, add=add, **kwargs)

    def login_test2(self, force: bool = False, add: bool = False, **kwargs):
        """Logs testuser2 in.

        :param force: Whether to force the login route to be called even if the user is already logged in.
        :param add: Whether to add this user to the session group.
        :return: Response as a JSON dict.

        """
        return self.login('test2@example.com', 'test2pass', 'testuser2', force=force, add=add, **kwargs)

    def login_test3(self, force: bool = False, add: bool = False, **kwargs):
        """Logs testuser3 in.

        :param force: Whether to force the login route to be called even if the user is already logged in.
        :param add: Whether to add this user to the session group.
        :return: Response as a JSON dict.

        """
        return self.login('test3@example.com', 'test3pass', 'testuser3', force=force, add=add, **kwargs)

    def logout(self, user_id: Optional[int] = None):
        """Logs the specified user out.

        :param user_id: The id of the user to log out. If None, everyone in the session gets logged out.
        :return: Response as a JSON dict.

        """
        return self.json_post('/logout', json_data={'user_id': user_id})

    def login(self, email: str, passw: str, username: Optional[str] = None, force: bool = False,
              clear_last_doc: bool = True,
              add: bool = False, **kwargs):
        """Logs a user in.

        :param username: The username of the user.
        :param email: The email of the user.
        :param passw: The password of the user.
        :param clear_last_doc: Whether to clear the last document information from session (TODO: This parameter is
               possibly not needed anymore).
        :param force: Whether to force the login route to be called even if the user is already logged in.
        :param add: Whether to add this user to the session group.
        :return: Response as a JSON dict.

        """
        if self.client.application.got_first_request:
            if not force and not add:
                u = User.get_by_name(username)
                # if not flask.has_request_context():
                #     print('creating request context')
                #     tim.app.test_request_context().__enter__()
                with self.client.session_transaction() as s:
                    s['user_id'] = u.id
                    s.pop('other_users', None)
                self.client.session_transaction().__enter__()
                return
            if clear_last_doc:
                with self.client.session_transaction() as s:
                    s.pop('last_doc', None)
                    s.pop('came_from', None)
        return self.post('/altlogin',
                         data={'email': email, 'password': passw, 'add_user': add},
                         follow_redirects=True, **kwargs)

    def create_doc(self, path: Optional[str] = None,
                   from_file: Optional[str] = None,
                   initial_par: Optional[Union[str, List[str]]] = None,
                   settings: Optional[Dict] = None,
                   copy_from: Optional[int] = None,
                   cite: Optional[int] = None,
                   template: Optional[str] = None,
                   title: Optional[str] = None,
                   expect_status=200,
                   **kwargs
                   ) -> Optional[DocEntry]:
        """Creates a new document.

        :param copy_from: The id of an existing document if creating a copy.
        :param cite: The id of an existing document if citing another document.
        :param path: The path of the document.
        :param from_file: If specified, loads the document content from the specified file.
        :param initial_par: The content of the initial paragraph.
        :param settings: The settings for the document.
        :return: The DocEntry object.

        """
        if path is None:
            path = f'{self.current_user.get_personal_folder().path}/doc{self.doc_num}'
            self.__class__.doc_num += 1
        if title is None:
            title = 'document ' + str(self.doc_num)
        resp = self.json_post('/createItem', {
            'item_path': path,
            'item_type': 'document',
            'item_title': title,
            **({'copy': copy_from} if copy_from else {}),
            **({'template': template} if template else {}),
            **({'cite': cite} if cite else {})
        }, expect_status=expect_status, **kwargs)
        if expect_status != 200:
            return None
        self.assertIsInstance(resp['id'], int)
        self.assertEqual(path, resp['path'])
        de = DocEntry.find_by_path(path)
        doc = de.document
        self.init_doc(doc, from_file, initial_par, settings)
        return de

    def create_folder(self, path: str, title: str = 'foldertitle', expect_status=200, **kwargs):
        f = self.json_post('/createItem',
                           {'item_path': path,
                            'item_type': 'folder',
                            'item_title': title}, expect_status=expect_status, **kwargs)

        if expect_status == 200:
            self.assertEqual(path, f['path'])
            self.assertIsInstance(f['id'], int)
        return f

    def assert_elements_equal(self, e1, e2):
        try:
            self.assertEqual(e1.tag, e2.tag)
            self.assertEqual((e1.text or '').strip(), (e2.text or '').strip())
            self.assertEqual((e1.tail or '').strip(), (e2.tail or '').strip())
            self.assertEqual(e1.attrib, e2.attrib)
            self.assertEqual(len(e1), len(e2))
        except AssertionError:
            print(html.tostring(e1, pretty_print=True).decode('utf8'))
            print('--------------------------------------')
            print(html.tostring(e2, pretty_print=True).decode('utf8'))
            raise

        for c1, c2 in zip(e1, e2):
            self.assert_elements_equal(c1, c2)

    def create_translation(self, doc: DocEntry,
                           doc_title: str = 'title',
                           lang: str = 'en',
                           expect_contains=None,
                           expect_content=None,
                           expect_status=200,
                           **kwargs) -> Optional[Translation]:
        if expect_contains is None and expect_content is None:
            expect_contains = {'title': doc_title, 'path': doc.name + '/' + lang, 'name': doc.short_name}
        j = self.json_post(f'/translate/{doc.id}/{lang}',
                           {'doc_title': doc_title},
                           expect_contains=expect_contains, expect_content=expect_content, expect_status=expect_status,
                           **kwargs)
        return Translation.query.get(j['id']) if expect_status == 200 else None

    def assert_content(self, element: HtmlElement, expected: List[str]):
        pars = get_content(element)
        self.assertEqual(expected, pars)

    def get_updated_pars(self, d: DocInfo, **kwargs):
        return self.get(f'/getUpdatedPars/{d.id}', **kwargs)

    def get_personal_item_path(self, path):
        return f'{self.current_user.get_personal_folder().path}/{path}'

    def copy(self,
             doc: DocInfo,
             par_start: DocParagraph,
             par_end: DocParagraph, **kwargs):
        self.json_post(f'/clipboard/copy/{doc.id}/{par_start.get_id()}/{par_end.get_id()}', **kwargs)

    def cut(self,
            doc: DocInfo,
            par_start: DocParagraph,
            par_end: DocParagraph, **kwargs):
        self.json_post(f'/clipboard/cut/{doc.id}/{par_start.get_id()}/{par_end.get_id()}', **kwargs)

    def paste(self,
              doc: DocInfo,
              par_before: Optional[DocParagraph] = None,
              par_after: Optional[DocParagraph] = None,
              as_ref: bool = False, **kwargs):
        self.json_post(f'/clipboard/paste/{doc.id}',
                       {'par_before': par_before.get_id() if par_before else None,
                        'par_after': par_after.get_id() if par_after else None,
                        'as_ref': as_ref}, **kwargs)

    def show(self, doc: DocInfo):
        self.get('/clipboard', query_string={'doc_id': doc.id})

    def create_preamble_for(self, d: DocInfo, preamble_name='preamble', **kwargs):
        folder = d.location
        p = self.create_doc(f'{folder}/{TEMPLATE_FOLDER_NAME}/{PREAMBLE_FOLDER_NAME}/{preamble_name}', **kwargs)
        return p

    def assert_same_html(self, elem, expected_html: str):
        self.assert_elements_equal(elem, html.fromstring(expected_html))

    def get_no_warn(self, url: str, **kwargs):
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', ResourceWarning)
            result = self.get(url, **kwargs)
        return result

    def make_admin(self, u: User):
        gr = UserGroup.get_admin_group()
        self.add_to_group(gr, u)

    def add_to_group(self, gr: UserGroup, u: User):
        if u not in gr.users:
            u.groups.append(gr)
            db.session.commit()

    def post_comment(self, par, public, text, **kwargs):
        return self.json_post('/postNote', {'text': text,
                                            'access': 'everyone' if public else 'justme',
                                            'docId': par.doc.doc_id,
                                            'par': par.get_id()}, **kwargs)

    def post_preview(self, d: DocInfo, text: str, par_next=None, par=None, **kwargs):
        data = {'text': text}
        if par_next:
            data['par_next'] = par_next
        if par:
            data['par'] = par
        return self.json_post(f'/preview/{d.id}', data, **kwargs)

    def upload_file(self, d: DocInfo, content: bytes, filename: str, **extra_data):
        return self.post('/upload/', data={'doc_id': str(d.id), 'file': (io.BytesIO(content), filename), **extra_data})

    def mark_as_unread(self, doc: DocInfo, par_id):
        self.json_put(f'/unread/{doc.id}/{par_id}')

    def mark_as_read(self, doc: DocInfo, par_id, read_type=ReadParagraphType.click_red, **kwargs):
        self.json_put(f'/read/{doc.id}/{par_id}/{read_type.value}', **kwargs)

    def print_html(self, e: HtmlElement):
        print(html.tostring(e, pretty_print=True).decode())

    def create_plugin_json(self, d: DocInfo,
                           task_name: str,
                           par_id: str = None,
                           markup=None,
                           state=None,
                           toplevel=None,
                           info=None):
        if not toplevel:
            toplevel = {}
        if not markup:
            markup = {}
        basic_task_id = f"{d.id}.{task_name}"
        expected_json = {
            **toplevel,
            "info": info,
            "markup": {
                "hidden_keys": [],
                **markup,
            },
            "state": state,
            "taskID": basic_task_id,
            "anonymous": True,
            "doLazy": False,
            "preview": False,
            "review": False,
            "targetFormat": "latex",
            "taskIDExt": f"{d.id}.{task_name}.{par_id}" if par_id else basic_task_id,
            "user_id": self.current_user.name,
            "userPrint": False,
        }
        return expected_json

    def make_base64(self, d: dict):
        """Converts the given dict to a base64-encoded JSON string."""
        return base64.b64encode(json.dumps(d, sort_keys=True).encode()).decode()

    def assert_plugin_json(self, e: HtmlElement, content: Dict[str, Any]):
        b64str = e.attrib['json']
        json_str = base64.b64decode(b64str)
        self.assertEqual(content, json.loads(json_str))

    def get_state(self, aid: int, **kwargs):
        self.get('/getState',
                 query_string={
                     'user_id': self.current_user_id(),
                     'answer_id': aid,
                 },
                 **kwargs,
                 )


if __name__ == '__main__':
    unittest.main()


def get_note_id_from_json(json):
    note_id = int(re.search(r'note-id="(\d+)"', json['texts']).groups()[0])
    return note_id
