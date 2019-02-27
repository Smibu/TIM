import base64
import io
import json
import re
from collections import OrderedDict
from datetime import timedelta
from itertools import product
from typing import Dict, Any

import dateutil.parser
from lxml import html
from lxml.html import HtmlElement

from timApp.answer.answer import Answer
from timApp.answer.pointsumrule import PointSumRule, PointType
from timApp.auth.sessioninfo import get_current_user_object
from timApp.document.docinfo import DocInfo
from timApp.document.docparagraph import DocParagraph
from timApp.document.randutils import random_id
from timApp.plugin.plugin import Plugin, find_plugin_from_document
from timApp.plugin.taskid import TaskId
from timApp.tests.db.timdbtest import TEST_USER_1_ID, TEST_USER_2_ID, TEST_USER_1_NAME, TEST_USER_1_USERNAME, \
    TEST_USER_2_USERNAME
from timApp.tests.server.timroutetest import TimRouteTest
from timApp.timdb.sqa import db
from timApp.user.special_group_names import ANONYMOUS_USERNAME
from timApp.user.user import User
from timApp.user.userutils import grant_view_access, grant_access, get_anon_group_id, get_anon_user_id
from timApp.util.flask.responsehelper import to_dict
from timApp.util.utils import EXAMPLE_DOCS_PATH, get_current_time
from timApp.velp.velp_models import Annotation

PLUGIN_NOT_EXIST_ERROR = {}  # TODO the error value should be better


class PluginTest(TimRouteTest):
    answer_error = {'error': "You don't have access to this answer."}

    def test_plugin(self):
        self.login_test1()
        doc = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/mmcq_example.md')
        resp = self.get(f'/view/{doc.id}')
        tree = html.fromstring(resp)
        mmcq_xpath = fr'.//div[@class="par mmcq"]/div[@class="parContent"]/div[@id="{doc.id}.mmcqexample.{doc.document.get_paragraphs()[0].get_id()}"]'
        plugs = tree.findall(mmcq_xpath)
        self.assertEqual(1, len(plugs))
        task_name = 'mmcqexample'
        plugin_type = 'mmcq'
        task_id = f'{doc.id}.{task_name}'
        tid = TaskId.parse(task_id)
        u = self.test_user_1
        par_id = find_plugin_from_document(doc.document, tid, u).par.get_id()
        task_id_ext = task_id + '.' + par_id
        task_id_ext_wrong = task_id + '.' + par_id + 'x'

        resp = self.post_answer(plugin_type, task_id, [True, False, False])
        self.check_ok_answer(resp)

        resp = self.post_answer(plugin_type, task_id, [True, False, False])
        self.check_failed_answer(resp)
        resp = self.post_answer(plugin_type, task_id_ext, [True, False, False])
        self.check_failed_answer(resp)
        self.post_answer(plugin_type, task_id_ext_wrong, [True, False, False],
                         expect_status=200,  # TODO
                         expect_content=PLUGIN_NOT_EXIST_ERROR)

        wrongname = 'mmcqexamplez'
        self.post_answer(plugin_type, str(doc.id) + '.' + wrongname, [True, False, False],
                         expect_status=200,  # TODO
                         expect_content=PLUGIN_NOT_EXIST_ERROR)

        doc.document.set_settings({'global_plugin_attrs': {'all': {'answerLimit': 2}}})
        resp = self.post_answer(plugin_type, task_id, [True, True, False])
        self.check_ok_answer(resp)

        resp = self.post_answer(plugin_type, task_id, [True, False, False])
        self.check_failed_answer(resp, is_new=True)

        doc.document.set_settings({'global_plugin_attrs': {'mmcq': {'answerLimit': None}}})
        resp = self.post_answer(plugin_type, task_id, [True, True, True])
        self.check_ok_answer(resp)
        resp = self.post_answer(plugin_type, task_id, [True, True, True])
        self.check_ok_answer(resp, is_new=False)

        doc.document.set_settings({'global_plugin_attrs': {'mmcq': {'answerLimit': None, 'pointsRule': {'multiplier': 0}}}})
        resp = self.post_answer(plugin_type, task_id, [False, False, True])
        self.check_ok_answer(resp)

        doc.document.set_settings({'global_plugin_attrs': {'mmcq': {'answerLimit': None, 'pointsRule': {'multiplier': 3}}}})
        resp = self.post_answer(plugin_type, task_id, [True, False, True])
        self.check_ok_answer(resp)

        answer_list = self.get_task_answers(task_id)

        self.assertEqual(
            [{'users': [{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME}],
              'content': '[true, false, true]',
              'points': 9.0, 'task_id': task_id, 'valid': True, 'last_points_modifier': None},
             {'users': [{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME}],
              'content': '[false, false, true]',
              'points': None, 'task_id': task_id, 'valid': True, 'last_points_modifier': None},
             {'users': [{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME}],
              'content': '[true, true, true]',
              'points': 2.0, 'task_id': task_id, 'valid': True, 'last_points_modifier': None},
             {'users': [{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME}],
              'content': '[true, false, false]',
              'points': 2.0, 'task_id': task_id, 'valid': False, 'last_points_modifier': None},
             {'users': [{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME}],
              'content': '[true, true, false]',
              'points': 1.0, 'task_id': task_id, 'valid': True, 'last_points_modifier': None},
             {'users': [{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME}],
              'content': '[true, false, false]',
              'points': 2.0, 'task_id': task_id, 'valid': True, 'last_points_modifier': None}],
            self.exclude_answered_on_id(answer_list))
        for ans in answer_list:
            d = dateutil.parser.parse(ans['answered_on'])
            self.assertLess(d - get_current_time(), timedelta(seconds=5))

        self.post_answer(plugin_type, task_id, [True, True, False],
                         save_teacher=False, teacher=True, answer_id=answer_list[0]['id'],
                         user_id=self.current_user_id() - 1, expect_status=400,
                         expect_content={'error': 'userId is not associated with answer_id'})

        resp = self.post_answer(plugin_type, task_id, [False, False, False],
                                save_teacher=False, teacher=True, answer_id=answer_list[0]['id'],
                                user_id=self.current_user_id())
        self.check_ok_answer(resp, is_new=False)

        par_id = find_plugin_from_document(doc.document, tid, u).par.get_id()
        aid = answer_list[0]['id']
        j = self.get('/getState',
                     query_string={'user_id': self.current_user_id(),
                                   'answer_id': aid,
                                   'par_id': par_id,
                                   'doc_id': doc.id})
        self.assertEqual({'html': "<div id='" + task_id_ext + f"' answer-id='{aid}' data-plugin='/mmcq' class=\"pluginmmcq\" ><mmcq "
                                                                  "data-content='{&quot;state&quot;:[true,false,true],&quot;question&quot;:{&quot;falseText&quot;:null,&quot;button&quot;:null,&quot;wrongText&quot;:null,&quot;onTry&quot;:null,&quot;header&quot;:null,&quot;stem&quot;:&quot;Answer "
                                                                  'yes or no to the following '
                                                                  'questions.&quot;,&quot;headerText&quot;:null,&quot;choices&quot;:[{&quot;text&quot;:&quot;&lt;span '
                                                                  'class=\\&quot;math '
                                                                  'inline\\&quot;&gt;\\\\(2^2=4\\\\)&lt;/span&gt;&quot;,&quot;correct&quot;:true,&quot;reason&quot;:&quot;This '
                                                                  'is true.&quot;},{&quot;text&quot;:&quot;All '
                                                                  'cats are '
                                                                  'black.&quot;,&quot;correct&quot;:false,&quot;reason&quot;:&quot;No '
                                                                  'way.&quot;},{&quot;text&quot;:&quot;Guess.&quot;,&quot;correct&quot;:true,&quot;reason&quot;:&quot;No '
                                                                  "reason.&quot;}],&quot;trueText&quot;:null,&quot;buttonText&quot;:null,&quot;correctText&quot;:null}}'></mmcq></div>",
                              'reviewHtml': None}, j)

        grant_access(get_anon_group_id(), doc.id, 'view')

        tree = self.get(f'/view/{doc.id}', as_tree=True, query_string={'lazy': False})
        plugs = tree.findall(mmcq_xpath)
        self.assertEqual(1, len(plugs))
        self.assertEqual([True, False, True], json.loads(plugs[0].find('mmcq').get('data-content'))['state'])

        # Testing noanswers parameter: There should be no answers in the document
        tree = self.get(f'/view/{doc.id}', as_tree=True, query_string={'lazy': False, 'noanswers': True})
        plugs = tree.findall(mmcq_xpath)
        self.assertEqual(1, len(plugs))
        self.assertIsNone(json.loads(plugs[0].find('mmcq').get('data-content')).get('state'))

        summary = tree.findall('.//div[@class="taskSummary"]')
        self.assertEqual(0, len(summary))
        doc.document.add_setting('show_task_summary', True)
        tree = self.get(f'/view/{doc.id}', as_tree=True, query_string={'lazy': False})
        summary = tree.findall('.//div[@class="taskSummary"]')
        self.assertEqual(1, len(summary))

        self.logout()
        resp = self.post_answer(plugin_type, task_id, [True, False, False])
        self.check_ok_answer(resp)

        anon_id = get_anon_user_id()
        anon = User.get_by_id(anon_id)
        anon_answers = to_dict(anon.get_answers_for_task(task_id).all())

        self.assertEqual(
            [{'users': [{'real_name': 'Anonymous user', 'email': None, 'id': anon_id, 'name': ANONYMOUS_USERNAME}],
              'content': '[true, false, false]',
              'points': 6.0,
              'task_id': task_id,
              'valid': True,
              'last_points_modifier': None}],
            self.exclude_answered_on_id(anon_answers))

        self.get('/getState', query_string={'user_id': anon_id,
                                            'answer_id': answer_list[0]['id'],
                                            'par_id': par_id,
                                            'doc_id': doc.id}, expect_status=403)
        self.get('/getState', query_string={'user_id': anon_id,
                                            'answer_id': anon_answers[0]['id'],
                                            'par_id': par_id,
                                            'doc_id': doc.id}, expect_status=403)
        tree = self.get(f'/view/{doc.id}', as_tree=True, query_string={'lazy': False})
        plugs = tree.findall(mmcq_xpath)
        summary = tree.findall('.//div[@class="taskSummary"]')
        self.assertEqual(1, len(plugs))
        self.assertEqual(0, len(summary))
        # Anonymous users can't see their answers
        self.assertIsNone(json.loads(plugs[0].find('mmcq').get('data-content'))['state'])

        self.login_test1()
        self.get(f'/getTaskUsers/{task_id}',
                 expect_content=[{'email': None, 'id': 0, 'name': 'Anonymous', 'real_name': 'Anonymous user'},
                                 {'email': 'test1@example.com',
                                  'id': 2,
                                  'name': 'testuser1',
                                  'real_name': 'Test user 1'}])
        self.get(f'/getTaskUsers/{task_id}',
                 query_string={'group': 'testuser1'},
                 expect_content=[{'email': 'test1@example.com',
                                  'id': 2,
                                  'name': 'testuser1',
                                  'real_name': 'Test user 1'}])

        self.get(doc.get_url_for_view('teacher'))

    def exclude_answered_on_id(self, answer_list):
        return [{k: v for k, v in ans.items() if k not in ('answered_on', 'id')} for ans in answer_list]

    def test_idless_plugin(self):
        self.login_test1()
        doc = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/idless_plugin.md').document
        resp = self.get(f'/view/{doc.doc_id}')
        tree = html.fromstring(resp)
        mmcq_xpath = fr'.//div[@class="par csPlugin"]/div[@class="parContent"]/div[@id="{doc.doc_id}..{doc.get_paragraphs()[0].get_id()}"]'
        plugs = tree.findall(mmcq_xpath)
        self.assertEqual(1, len(plugs))

    def test_upload(self):
        self.login_test1()
        doc = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/upload_plugin.md').document
        task_name = 'testupload'
        task_name2 = 'testupload2'
        task_id = f'{doc.doc_id}.{task_name}'
        filename = 'test.txt'
        file_content = 'test file'
        mimetype, ur, user_input = self.do_plugin_upload(doc, file_content, filename, task_id, task_name)
        self.do_plugin_upload(doc, file_content, 'test2.txt', task_id, task_name, expect_version=2)
        self.do_plugin_upload(doc, file_content, filename, task_id, task_name2)
        self.do_plugin_upload(doc, file_content, filename, task_id, task_name, expect_version=3)
        self.do_plugin_upload(doc, file_content, filename, task_id, task_name2, expect_version=2)
        self.post_answer('csPlugin', task_id, user_input,
                         expect_status=400,
                         expect_content={'error': f'File was already uploaded: {ur["file"]}'})
        invalid_file = '/test/test'
        resp = self.post_answer('csPlugin',
                                task_id,
                                {"uploadedFile": invalid_file,
                                 "uploadedType": mimetype,
                                 "markup": {"type": "upload"}},
                                expect_status=400,
                                expect_content={'error': f'Non-existent upload: {invalid_file}'}
                                )
        curr_name = self.current_user.name
        self.assertEqual(f'/uploads/{doc.doc_id}/{task_name}/{curr_name}/1/test.txt', ur['file'])
        self.assertEqual(file_content, self.get_no_warn(ur['file']))
        self.get(ur['file'] + 'x', expect_status=404)
        self.assertEqual(file_content,
                         self.get_no_warn(f'/uploads/{doc.doc_id}/{task_name}/{curr_name}'))
        self.get(f'/uploads/{doc.doc_id}/{task_name}', expect_status=400)
        self.get(f'/uploads/{doc.doc_id}', expect_status=400)
        self.get(f'/uploads', expect_status=404)
        self.login_test2()

        # Another user cannot see the file
        self.get(ur['file'], expect_status=403, expect_content=self.permission_error)

        # and cannot post answers
        resp = self.post_answer('csPlugin', task_id, user_input, expect_status=403,
                                expect_content=self.permission_error)

        # until he is granted a permission
        ug = self.current_group().id
        grant_view_access(ug, doc.doc_id)

        # but he still cannot see the file
        resp = self.post_answer('csPlugin', task_id, user_input, expect_status=403,
                                expect_content={'error': "You don't have permission to touch this file."})
        self.get(ur['file'], expect_status=403, expect_content=self.permission_error)

        # until the 'see answers' right is granted for the document
        grant_access(ug, doc.doc_id, 'see answers')
        self.get_no_warn(ur['file'], expect_content=file_content)

    def do_plugin_upload(self, doc, file_content, filename, task_id, task_name, expect_version=1):
        ur = self.post(f'/pluginUpload/{doc.doc_id}/{task_name}/',
                       data={'file': (io.BytesIO(bytes(file_content, encoding='utf-8')), filename)},
                       expect_status=200)
        mimetype = "text/plain"
        self.assertDictEqual({'file': f'/uploads/{doc.doc_id}/{task_name}/{self.current_user.name}/{expect_version}/{filename}',
                              'type': mimetype,
                              'block': ur['block']}, ur)
        self.assertIsInstance(ur['block'], int)
        user_input = {"uploadedFile": ur['file'], "uploadedType": mimetype, "markup": {"type": "upload"}}
        resp = self.post_answer('csPlugin', task_id, user_input)
        self.check_ok_answer(resp)
        return mimetype, ur, user_input

    def check_failed_answer(self, resp, is_new=False):
        self.assertIn('web', resp)
        self.assertIn('You have exceeded the answering limit.', resp['error'])
        self.assertEqual(is_new, resp['savedNew'] is not None)

    def check_ok_answer(self, resp, is_new=True):
        self.assertIn('web', resp)
        self.assertNotIn('error', resp)
        self.assertEqual(is_new, resp['savedNew'] is not None)

    def test_group_answering(self):
        self.login_test1()
        self.login_test2(add=True)
        doc = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/upload_plugin.md').document
        task_name = 'testupload'
        task_id = f'{doc.doc_id}.{task_name}'
        filename = 'test.txt'
        file_content = 'test file'
        mimetype, ur, user_input = self.do_plugin_upload(doc, file_content, filename, task_id, task_name)
        answer_list = self.get_task_answers(task_id)
        self.assertEqual(1, len(answer_list))
        self.assertListEqual([{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME},
                              {'real_name': 'Test user 2', 'email': 'test2@example.com', 'id': TEST_USER_2_ID, 'name': TEST_USER_2_USERNAME}],
                             answer_list[0]['users'])
        self.assertEqual(file_content, self.get_no_warn(ur['file']))
        self.login_test2()
        answer_list = self.get_task_answers(task_id)
        self.assertEqual(1, len(answer_list))
        self.assertListEqual([{'real_name': TEST_USER_1_NAME, 'email': 'test1@example.com', 'id': TEST_USER_1_ID, 'name': TEST_USER_1_USERNAME},
                              {'real_name': 'Test user 2', 'email': 'test2@example.com', 'id': TEST_USER_2_ID, 'name': TEST_USER_2_USERNAME}],
                             answer_list[0]['users'])
        self.assertEqual(file_content, self.get_no_warn(ur['file']))

    def test_all_answers(self):
        self.login_test1()
        doc = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/multiple_mmcqs.md')
        plugin_type = 'mmcq'
        task_id = f'{doc.id}.mmcqexample'
        task_id2 = f'{doc.id}.mmcqexample2'
        self.post_answer(plugin_type, task_id, [True, False, False])
        self.post_answer(plugin_type, task_id, [True, True, False])
        self.post_answer(plugin_type, task_id2, [True, False])
        grant_view_access(self.get_test_user_2_group_id(), doc.id)
        self.login_test2()
        self.post_answer(plugin_type, task_id, [True, True, True])
        self.post_answer(plugin_type, task_id2, [False, False])
        self.post_answer(plugin_type, task_id2, [False, True])
        self.post_answer(plugin_type, task_id2, [True, True])
        self.get(f'/allDocumentAnswersPlain/{doc.id}', expect_status=403)
        self.get(f'/allAnswersPlain/{task_id}', expect_status=403)
        self.login_test1()
        text = self.get(f'/allDocumentAnswersPlain/{doc.id}')
        date_re = r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}'
        self.assertRegex(text, fr"""
{TEST_USER_1_NAME}; {'testuser1'}; {re.escape(task_id)}; {date_re}; 1; 2\.0
\[True, False, False\]

----------------------------------------------------------------------------------
{'Test user 2'}; {'testuser2'}; {re.escape(task_id)}; {date_re}; 1; 2\.0
\[True, True, True\]

----------------------------------------------------------------------------------
{TEST_USER_1_NAME}; {'testuser1'}; {re.escape(task_id2)}; {date_re}; 1; 1\.0
\[True, False\]

----------------------------------------------------------------------------------
{'Test user 2'}; {'testuser2'}; {re.escape(task_id2)}; {date_re}; 1; 2\.0
\[False, False\]
""".strip())
        text2 = self.get(f'/allAnswersPlain/{task_id}')
        self.assertRegex(text2, fr"""
{TEST_USER_1_NAME}; {'testuser1'}; {re.escape(task_id)}; {date_re}; 1; 2\.0
\[True, False, False\]

----------------------------------------------------------------------------------
{'Test user 2'}; {'testuser2'}; {re.escape(task_id)}; {date_re}; 1; 2\.0
\[True, True, True\]
        """.strip())
        self.assertEqual('', self.get(f'/allAnswersPlain/{task_id}', query_string={'consent': 'true'}))

        # make sure invalid date won't throw
        self.get(f'/allDocumentAnswersPlain/{doc.id}', query_string={'period': 'other', 'periodTo': 'asd'})
        # using document path should work as well
        self.get(f'/allDocumentAnswersPlain/{doc.path}')
        # test age parameter
        all_text = self.get(f'/allDocumentAnswersPlain/{doc.path}', query_string={'age': 'all', 'valid': 'all'})
        self.assertGreater(len(all_text), len(text))
        invalid_age = self.get(f'/allDocumentAnswersPlain/{doc.path}', query_string={'age': 'asd'})
        self.assertEqual(invalid_age, text)

    def test_save_points(self):
        cannot_give_custom = {'error': 'You cannot give yourself custom points in this task.'}
        self.login_test1()
        doc = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/mmcq_example.md').document
        plugin_type = 'mmcq'
        task_id = f'{doc.doc_id}.mmcqexample'
        self.post_answer(plugin_type, task_id, [True, False, False])
        answer_list = self.get_task_answers(task_id)
        answer_id = answer_list[0]['id']
        self.assertEqual(2.0, answer_list[0]['points'])

        # Teacher can give any points regardless of plugin settings
        self.check_save_points(TEST_USER_1_ID, answer_id, 5, 200, self.ok_resp)
        answer_list = self.get_task_answers(task_id)
        self.assertEqual(5.0, answer_list[0]['points'])

        # Teacher can clear points
        self.check_save_points(TEST_USER_1_ID, answer_id, None, 200, self.ok_resp)
        self.check_save_points(TEST_USER_1_ID, answer_id, '', 200, self.ok_resp)
        answer_list = self.get_task_answers(task_id)
        self.assertEqual(None, answer_list[0]['points'])

        point_format_error = {'error': 'Invalid points format.'}
        self.check_save_points(TEST_USER_1_ID, answer_id, '6,6', 400, point_format_error)
        self.check_save_points(TEST_USER_1_ID, answer_id, '6.6', 200, self.ok_resp)
        answer_list = self.get_task_answers(task_id)
        self.assertEqual(6.6, answer_list[0]['points'])
        self.check_save_points(TEST_USER_2_ID, answer_id, None, 200, self.ok_resp)

        self.login_test2()
        self.check_save_points(TEST_USER_1_ID, answer_id, 1, 403, self.permission_error)
        self.check_save_points(TEST_USER_2_ID, answer_id, 1, 403, self.permission_error)
        grant_view_access(self.get_test_user_2_group_id(), doc.doc_id)
        self.post_answer(plugin_type, task_id, [True, False, False])
        answer_list = self.get_task_answers(task_id)
        answer_id2 = answer_list[0]['id']
        self.check_save_points(TEST_USER_1_ID, answer_id, 1, 403, self.permission_error)
        self.check_save_points(TEST_USER_2_ID, answer_id, 1, 403, self.answer_error)
        self.check_save_points(TEST_USER_1_ID, answer_id2, 1, 403, self.permission_error)

        self.check_save_points(TEST_USER_2_ID, answer_id2, 1, 400, cannot_give_custom)
        p = Plugin.from_task_id(task_id, user=get_current_user_object())
        p.set_value('pointsRule', {'allowUserMin': 0, 'allowUserMax': 5}).save()
        self.check_save_points(TEST_USER_2_ID, answer_id2, 6, 400, {'error': 'Points must be in range [0,5]'})
        self.check_save_points(TEST_USER_2_ID, answer_id2, 1, 200, self.ok_resp)
        self.check_save_points(TEST_USER_2_ID, answer_id2, None, 400, point_format_error)
        self.check_save_points(TEST_USER_2_ID, answer_id2, '', 400, point_format_error)

        grant_access(self.get_test_user_2_group_id(), doc.doc_id, 'see answers')
        self.check_save_points(TEST_USER_1_ID, answer_id, 1, 403, self.permission_error)
        grant_access(self.get_test_user_2_group_id(), doc.doc_id, 'teacher')
        self.check_save_points(TEST_USER_1_ID, answer_id, 1, 200, self.ok_resp)

    def test_point_sum_rule(self):
        def get_pts(rule):
            pts = OrderedDict([('1st', {'task_sum': 6.0, 'velp_sum': 7.0, 'total_sum': 13.0},),
                               ('2nd', {'task_sum': 1.0, 'velp_sum': 5.0, 'total_sum': 6.0},),
                               ('3rd', {'task_sum': 4.0, 'velp_sum': 4.0, 'total_sum': 8.0},)])
            pts2 = OrderedDict([('1st', {'task_sum': 3.0, 'velp_sum': 7.0, 'total_sum': 10.0},),
                                ('2nd', {'task_sum': 8.0, 'velp_sum': 5.0, 'total_sum': 13.0},),
                                ('3rd', {'task_sum': 5.0, 'velp_sum': 4.0, 'total_sum': 9.0},)])
            for k, _ in pts.items():
                for n, t in zip(('task_sum', 'velp_sum'), (PointType.task, PointType.velp)):
                    if t in rule.groups[k].point_types:
                        pass
                    else:
                        pts[k]['total_sum'] -= pts[k][n]
                        pts2[k]['total_sum'] -= pts2[k][n]
                        pts[k][n] = 0
                        pts2[k][n] = 0
            return pts, pts2

        self.login_test1()
        d = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/mmcq_example.md').document
        timdb = self.get_db()
        grant_view_access(self.get_test_user_2_group_id(), d.doc_id)
        task_ids = [TaskId.parse(f'{d.doc_id}.{a}-{b}') for a, b in product(('t1', 't2', 't3'), ('a', 'b', 'c'))]
        answers = [
            [True, False, True],    # U1: 3 p + 3 v =  6, U2: 0 p + 3 v = 3
            [True, True, False],    # U1: 1 p + 1 v =  2, U2: 2 p + 1 v = 3
            [True, False, False],   # U1: 2 p + 3 v =  5, U2: 1 p + 3 v = 4
            #                         U1: 6 p + 7 v = 13, U2: 3 p + 7 v = 10

            [False, True, False],   # U1: 0 p + 1 v = 1, U2: 3 p + 1 v = 4
            [False, True, False],   # U1: 0 p + 3 v = 3, U2: 3 p + 3 v = 6
            [False, False, False],  # U1: 1 p + 1 v = 2, U2: 2 p + 1 v = 3
            #                         U1: 1 p + 5 v = 6, U2: 8 p + 5 v = 13

            [False, False, True],   # U1: 2 p + 2 v = 4, U2: 1 p + 2 v = 3
            [True, True, False],    # U1: 1 p + 0 v = 1, U2: 2 p + 0 v = 2
            [False, False, False],  # U1: 1 p + 2 v = 2, U2: 2 p + 2 v = 4
            #                         U1: 4 p + 4 v = 8, U2: 5 p + 4 v = 9
        ]
        pars = d.get_paragraphs()
        new = pars[0]
        answer_ids, answer_ids2 = [], []
        for t, a in zip(task_ids, answers):
            new = new.clone()
            new.set_id(random_id())
            new.set_attr('taskId', t.task_name)
            new.save(add=True)
            answer_ids.append(self.post_answer('mmcq', t.doc_task, a)['savedNew'])
        self.login_test2()
        for t, a in zip(task_ids, answers):
            answer_ids2.append(self.post_answer('mmcq', t.doc_task, [not b for b in a])['savedNew'])
        _, velp_ver_id = timdb.velps.create_new_velp(TEST_USER_1_ID, 'Test velp')
        # add a 1-point annotation to every answer except the last three
        for ans in answer_ids[:-3] + answer_ids2[:-3]:
            a = Annotation(velp_version_id=velp_ver_id, points=1, annotator_id=TEST_USER_2_ID, answer_id=ans)
            db.session.add(a)

        # add a 2-point annotation to every other answer
        for ans in answer_ids[::2] + answer_ids2[::2]:
            a = Annotation(velp_version_id=velp_ver_id, points=2, annotator_id=TEST_USER_2_ID, answer_id=ans)
            db.session.add(a)

        db.session.commit()
        groups_default = ({'match': ['t1-a', 't1-b', 't1-c']}, 't2.*', 't3.*')
        groups_type_t = ({'match': 't1.*', 'type': 't'},
                         {'match': 't2.*', 'type': 't'},
                         {'match': 't3.*', 'type': 't'})
        groups_type_v = ({'match': 't1.*', 'type': 'v'},
                         {'match': 't2.*', 'type': 'v'},
                         {'match': 't3.*', 'type': 'v'})
        groups_type_mixed = ({'match': 't1.*', 'type': 't'},
                             {'match': 't2.*', 'type': 'v'},
                             {'match': 't3.*', 'type': 'tv'})

        cases = [
            (groups_type_t, 'best', 0, (0, 0, 0), (0, 0, 0)),
            (groups_type_t, 'best', 1, (6, 0, 6), (8, 0, 8)),
            (groups_type_t, 'best', 2, (10, 0, 10), (13, 0, 13)),
            (groups_type_t, 'best', 3, (11, 0, 11), (16, 0, 16)),
            (groups_type_t, 'worst', 0, (0, 0, 0), (0, 0, 0)),
            (groups_type_t, 'worst', 1, (1, 0, 1), (3, 0, 3)),
            (groups_type_t, 'worst', 2, (5, 0, 5), (8, 0, 8)),
            (groups_type_t, 'worst', 3, (11, 0, 11), (16, 0, 16)),

            (groups_default, 'best', 0, (0, 0, 0), (0, 0, 0)),
            (groups_default, 'best', 1, (6, 7, 13), (8, 5, 13)),
            (groups_default, 'best', 2, (10, 11, 21), (11, 12, 23)),
            (groups_default, 'best', 3, (11, 16, 27), (16, 16, 32)),
            (groups_default, 'worst', 0, (0, 0, 0), (0, 0, 0)),
            (groups_default, 'worst', 1, (1, 5, 6), (5, 4, 9)),
            (groups_default, 'worst', 2, (5, 9, 14), (8, 11, 19)),
            (groups_default, 'worst', 3, (11, 16, 27), (16, 16, 32)),

            (groups_type_v, 'best', 0, (0, 0, 0), (0, 0, 0)),
            (groups_type_v, 'best', 1, (0, 7, 7), (0, 7, 7)),
            (groups_type_v, 'best', 2, (0, 12, 12), (0, 12, 12)),
            (groups_type_v, 'best', 3, (0, 16, 16), (0, 16, 16)),
            (groups_type_v, 'worst', 0, (0, 0, 0), (0, 0, 0)),
            (groups_type_v, 'worst', 1, (0, 4, 4), (0, 4, 4)),
            (groups_type_v, 'worst', 2, (0, 9, 9), (0, 9, 9)),
            (groups_type_v, 'worst', 3, (0, 16, 16), (0, 16, 16)),

            (groups_type_mixed, 'best', 0, (0, 0, 0), (0, 0, 0)),
            (groups_type_mixed, 'best', 1, (4, 4, 8), (5, 4, 9)),
            (groups_type_mixed, 'best', 2, (10, 4, 14), (5, 9, 14)),
            (groups_type_mixed, 'best', 3, (10, 9, 19), (8, 9, 17)),
            (groups_type_mixed, 'worst', 0, (0, 0, 0), (0, 0, 0)),
            (groups_type_mixed, 'worst', 1, (0, 5, 5), (3, 0, 3)),
            (groups_type_mixed, 'worst', 2, (6, 5, 11), (3, 5, 8)),
            (groups_type_mixed, 'worst', 3, (10, 9, 19), (8, 9, 17)),
        ]

        for (g1, g2, g3), count_type, count, (tasksum1, velpsum1, sum1), (tasksum2, velpsum2, sum2) in cases:
            rule_dict = {'groups': {'1st': g1, '2nd': g2, '3rd': g3},
                         'count': {count_type: count}}
            rule = PointSumRule(rule_dict)
            points = timdb.answers.get_points_by_rule(
                rule_dict,
                task_ids, [TEST_USER_1_ID, TEST_USER_2_ID])
            self.assertEqual(tasksum1, points[TEST_USER_1_ID]['task_sum'])
            self.assertEqual(tasksum2, points[TEST_USER_2_ID]['task_sum'])
            self.assertEqual(velpsum1, points[TEST_USER_1_ID]['velp_sum'])
            self.assertEqual(velpsum2, points[TEST_USER_2_ID]['velp_sum'])
            pts, pts2 = get_pts(rule)
            for k, _ in pts.items():
                for n, t in zip(('task_sum', 'velp_sum'), (PointType.task, PointType.velp)):
                    if t in rule.groups[k].point_types:
                        self.assertEqual(pts[k][n], points[TEST_USER_1_ID]['groups'][k][n])
                        self.assertEqual(pts2[k][n], points[TEST_USER_2_ID]['groups'][k][n])
                    else:
                        self.assertEqual(0, points[TEST_USER_1_ID]['groups'][k][n])
                        self.assertEqual(0, points[TEST_USER_2_ID]['groups'][k][n])
                self.assertEqual(pts[k]['total_sum'], points[TEST_USER_1_ID]['groups'][k]['total_sum'])
                self.assertEqual(pts2[k]['total_sum'], points[TEST_USER_2_ID]['groups'][k]['total_sum'])
            points = timdb.answers.get_points_by_rule(
                {'groups': {'1st': g1, '2nd': g2, '3rd': g3},
                 'count': {count_type: count}},
                task_ids, [TEST_USER_1_ID, TEST_USER_2_ID], flatten=True)
            self.assertEqual([{'groups': pts,
                               'task_count': 3,
                               'task_points': tasksum1,
                               'velp_points': velpsum1,
                               'total_points': sum1,
                               'velped_task_count': 3,
                               **self.test_user_1.basic_info_dict,
                               'user': self.test_user_1},
                              {'groups': pts2,
                               'task_count': 3,
                               'task_points': tasksum2,
                               'velp_points': velpsum2,
                               'total_points': sum2,
                               'velped_task_count': 3,
                               **self.test_user_2.basic_info_dict,
                               'user': self.test_user_2
                               }], points)

        rule_dict = {'groups': {'1st': groups_type_t[0], '2nd': groups_type_t[1], '3rd': groups_type_t[2]},
                     'count': {'best': 2}}
        _, pts2 = get_pts(PointSumRule(rule_dict))
        d.set_settings({'show_task_summary': True,
                        'point_sum_rule': rule_dict})
        d_html = self.get(f'/view/{d.doc_id}', as_tree=True)
        task_summary_text = d_html.cssselect('.taskSummary')[0].text_content()
        self.assertIn(f'Total points: {cases[2][4][0]}', task_summary_text)
        self.assertIn(', '.join((f'{k}: {v["total_sum"]}' for k, v in pts2.items())), task_summary_text)

        # Make sure invalid settings don't crash the document
        d.add_setting('point_sum_rule', {'groups': {'1st': '*', '2nd': 't2.*', '3rd': 't3.*'},
                                         'count': {'best': 'asd'}})
        self.get(f'/view/{d.doc_id}')
        d.add_setting('point_sum_rule', {'groups': 'test'})
        self.get(f'/view/{d.doc_id}')
        d.add_setting('point_sum_rule', {'groupz': 'test'})
        self.get(f'/view/{d.doc_id}')
        d.add_setting('point_sum_rule', [])
        self.get(f'/view/{d.doc_id}')
        d.add_setting('point_sum_rule', None)
        self.get(f'/view/{d.doc_id}')

    def check_save_points(self, user_id, answer_id, points, expect_status, expect_content):
        self.json_put(f'/savePoints/{user_id}/{answer_id}',
                      json_data={'points': points},
                      expect_status=expect_status,
                      expect_content=expect_content)

    def test_find_tasks(self):
        self.login_test1()
        d = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/programming_examples.md').document
        tasks = d.get_tasks()
        self.assertEqual(27, len(list(tasks)))

    def test_interval(self):
        self.login_test1()
        d = self.create_doc(from_file=f'{EXAMPLE_DOCS_PATH}/mmcq_example.md')
        p = Plugin.from_paragraph(d.document.get_paragraphs()[0])
        p.set_value('answerLimit', None)

        p.set_value('starttime', '2000-01-01 00:00:00')
        p.set_value('deadline',  '2100-01-01 00:00:00')
        p.save()
        resp = self.post_answer(p.type, p.task_id.doc_task, [])
        self.assertNotIn('error', resp)

        p.set_value('starttime', '2099-01-01 00:00:00')
        p.save()
        resp = self.post_answer(p.type, p.task_id.doc_task, [])
        self.assertEqual(resp['error'], 'You cannot submit answers yet.')

        p.set_value('starttime', '2000-01-01 00:00:00')
        p.set_value('deadline', '2000-01-02 00:00:00')
        p.save()
        resp = self.post_answer(p.type, p.task_id.doc_task, [])
        self.assertEqual(resp['error'], 'The deadline for submitting answers has passed.')

        p.set_value('starttime', 'asdasd')
        p.save()
        self.post_answer(p.type, p.task_id.doc_task, [], expect_status=400, expect_content={'error': 'Invalid date format: asdasd'})
        self.get(f'/taskinfo/{p.task_id.doc_task}', expect_status=400, expect_content={'error': 'Invalid date format: asdasd'})

    def test_deadline_datetime(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {#t plugin="mmcq"}
deadline: 2016-10-11 20:59:59
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
```
""")
        p = Plugin.from_paragraph(d.document.get_paragraphs()[0])
        resp = self.post_answer(p.type, p.task_id.doc_task, [])
        self.assertEqual(resp['error'], 'The deadline for submitting answers has passed.')
        self.get(d.url_relative)

    def test_invalid_interval(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {#t plugin="csPlugin"}
starttime: 15
```

``` {#t2 plugin="csPlugin"}
starttime:
deadline:
```
""")
        p = Plugin.from_paragraph(d.document.get_paragraphs()[0])
        self.post_answer(p.type, p.task_id.doc_task, [],
                         expect_status=400,
                         expect_content='Invalid date format: 15',
                         json_key='error')
        p = Plugin.from_paragraph(d.document.get_paragraphs()[1])
        self.post_answer(p.type, p.task_id.doc_task, [])

    def test_invalid_yaml(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {plugin=showVideo}
```

``` {plugin=showVideo}
a
```

""")
        r = self.get(d.url, as_tree=True).cssselect('.parContent')
        self.assertTrue(r[0].cssselect('video-runner'))
        self.assertEqual('Plugin showVideo error: YAML is malformed: a', r[1].text_content().strip())

    def test_nonexistent_plugin(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {plugin=asdasd}
```
        """)
        self.get(d.url)

    def test_no_need_browser(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {plugin=showVideo}
```

``` {plugin=showImage}
```

``` {plugin=showCode}
```

``` {plugin=graphviz}
```
        """)
        e = self.get(d.url, as_tree=True)
        ab = e.cssselect('answerbrowser')
        ablazy = e.cssselect('tim-plugin-loader')
        self.assertFalse(ab)
        self.assertTrue(ablazy)

    def test_lazyonly_browser(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {plugin=graphviz}
lazy: true
```
        """)
        e = self.get(d.url, as_tree=True)
        ablazy = e.cssselect('tim-plugin-loader')
        self.assertEqual({'type': 'full', 'task-id': ''}, ablazy[0].attrib)

    def test_cache_no_browser(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {plugin=graphviz}
lazy: true
cache: true
```
        """)
        e = self.get(d.url, as_tree=True)
        ablazy = e.cssselect('tim-plugin-loader')
        self.assertFalse(ablazy)

    def test_invalid_taskid(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {#t1.1 plugin="mmcq"}
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
```
""")
        par = d.document.get_paragraphs()[0]
        self.post_answer('mmcq', f'{d.id}.t1.1.{par.get_id()}', [],
                         expect_content='The format of task id is invalid. Dot characters are not allowed.',
                         json_key='error', expect_status=400)

        # TODO These two need better error messages.
        self.post_answer('mmcq', f't1.1.{par.get_id()}', [],
                         expect_content='The format of task id is invalid. Dot characters are not allowed.',
                         json_key='error', expect_status=400)
        self.post_answer('mmcq', f'{par.get_id()}', [],
                         expect_content='The format of task id is invalid. Dot characters are not allowed.',
                         json_key='error', expect_status=400)

    def test_plugin_in_preamble(self):
        self.run_plugin_in_preamble('a/a', create_preamble_translation=True)
        self.run_plugin_in_preamble('b/b', create_preamble_translation=False)

    def run_plugin_in_preamble(self, doc_path: str, create_preamble_translation=True):
        self.login_test1()
        d = self.create_doc(path=self.get_personal_item_path(doc_path))
        p = self.create_preamble_for(d)
        p.document.add_text("""
``` {#t plugin="mmcq"}
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
```
        """)
        d.document.insert_preamble_pars()
        par = d.document.get_paragraphs()[0]
        plug = Plugin.from_paragraph(par)
        self.assertEqual(f'{d.id}.t', plug.task_id.doc_task)
        resp = self.post_answer(plug.type, plug.task_id.extended, [True])
        a: Answer = Answer.query.get(resp['savedNew'])
        self.assertEqual(1, a.points)
        self.assertEqual(f'{d.id}.t', a.task_id)

        if create_preamble_translation:
            tr_p = self.create_translation(p)
            tr_par = tr_p.document.get_paragraphs()[0]
            tr_par.set_markdown(par.get_markdown().replace('true', 'false'))
            tr_par.save()
        else:
            tr_p = p

        tr = self.create_translation(d)
        tr.document.insert_preamble_pars()

        resp = self.post_answer(
            plug.type,
            plug.task_id.extended,
            [False],
            ref_from=(tr.id, tr.document.get_paragraphs()[0].get_id()))
        a: Answer = Answer.query.get(resp['savedNew'])
        self.assertEqual(1 if create_preamble_translation else 0, a.points)
        self.assertEqual(f'{d.id}.t', a.task_id)
        self.check_plugin_ref_correct(tr, d, p.document.get_paragraphs()[0], preamble_doc=tr_p)

    def test_referenced_plugin_in_preamble(self):
        self.run_referenced_plugin_in_preamble('c/c', create_preamble_translation=True)
        self.run_referenced_plugin_in_preamble('d/d', create_preamble_translation=False)

    def run_referenced_plugin_in_preamble(self, doc_path: str, create_preamble_translation=True):
        self.login_test1()
        d = self.create_doc(path=self.get_personal_item_path(doc_path))
        plugin_doc = self.create_doc(initial_par="""
``` {#t plugin="mmcq"}
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
        """)
        p = self.create_preamble_for(d)
        p.document.add_paragraph_obj(plugin_doc.document.get_paragraphs()[0].create_reference(p.document))
        plugin_par = plugin_doc.document.get_paragraphs()[0]
        plug = Plugin.from_paragraph(plugin_par)
        d.document.insert_preamble_pars()
        # The plugin is a reference, so it exists only in the original document.
        self.post_answer(plug.type, f'{d.id}.t', [True],
                         expect_status=200,  # TODO
                         expect_content=PLUGIN_NOT_EXIST_ERROR,
                         )

        resp = self.post_answer(plug.type, plug.task_id.extended, [True],
                                ref_from=(d.id, d.document.get_paragraphs()[0].get_id()))
        a: Answer = Answer.query.get(resp['savedNew'])
        self.assertEqual(1, a.points)
        self.assertEqual(plug.task_id.doc_task, a.task_id)

        if create_preamble_translation:
            tr_p = self.create_translation(p)
        else:
            tr_p = p

        tr = self.create_translation(d)
        tr.document.insert_preamble_pars()

        resp = self.post_answer(
            plug.type,
            plug.task_id.extended,
            [False],
            ref_from=(tr.id, tr.document.get_paragraphs()[0].get_id()))
        a: Answer = Answer.query.get(resp['savedNew'])
        self.assertEqual(0, a.points)
        self.assertEqual(plug.task_id.doc_task, a.task_id)
        self.check_plugin_ref_correct(tr, plugin_doc, plugin_par, preamble_doc=tr_p)

    def test_reference_to_preamble(self):
        self.login_test1()
        d = self.create_doc(path=self.get_personal_item_path('e/e'))
        p = self.create_preamble_for(d)
        p.document.add_text("""
``` {#t plugin="mmcq"}
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
```
                """)
        tr_p = self.create_translation(p)
        tr_p.document.set_settings({'global_plugin_attrs': {'all': {'buttonText': 'This is in English'}}})

        self.check_plugin_ref_correct(tr_p, p, p.document.get_paragraphs()[0])
        n = self.create_doc()
        n.document.add_paragraph_obj(tr_p.document.get_paragraphs()[1].create_reference(n.document))
        # print(f'd={d.id} p={p.id} tr_p={tr_p.id} n={n.id}')

        tr_d = self.create_translation(d)
        self.check_plugin_ref_correct(n, p, p.document.get_paragraphs()[0])

        n = self.create_doc()
        tr_d.document.insert_preamble_pars()
        n.document.add_paragraph_obj(tr_d.document.get_paragraphs()[0].create_reference(n.document))
        self.check_plugin_ref_correct(n, d, p.document.get_paragraphs()[0], text_to_check='This is in English')

    def check_plugin_ref_correct(self, doc_to_check: DocInfo, expected_doc: DocInfo, expected_par: DocParagraph,
                                 text_to_check='',
                                 preamble_doc: DocInfo = None):
        par = self.get(doc_to_check.url, as_tree=True).cssselect('mmcq')[0].getparent().getparent().getparent()
        # print(html.tostring(par, pretty_print=True).decode())
        if preamble_doc:
            self.assertEqual(preamble_doc.path, par.attrib['data-from-preamble'])
        else:
            self.assertIsNone(par.attrib.get('data-from-preamble'))
        if text_to_check:
            self.assertIn(text_to_check, html.tostring(par).decode())
        # print(f'{expected_doc.id}.t.{expected_par.get_id()}')
        self.assertEqual(expected_par.get_id(), par.attrib['ref-id'])
        self.assertEqual(str(expected_doc.id), par.attrib['ref-doc-id'])
        self.assertTrue(par.cssselect(fr'#{expected_doc.id}\.t\.{expected_par.get_id()}'))

    def test_answer_rename(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {#t plugin="mmcq"}
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
```

``` {#t2 plugin="mmcq"}
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
```
        """)
        p = Plugin.from_paragraph(d.document.get_paragraphs()[0])
        p2 = Plugin.from_paragraph(d.document.get_paragraphs()[1])
        self.post_answer(p.type, p.task_id.doc_task, [True, False, False])
        self.post_answer(p.type, p.task_id.doc_task, [True, True, False])
        self.assertEqual(2, Answer.query.filter_by(task_id=p.task_id.doc_task).count())
        self.get(f'/renameAnswers/{p.task_id.task_name}/ä/{d.id}',
                 expect_status=400,
                 expect_content={'error': 'Invalid task name: ä'})
        self.get(f'/renameAnswers/{p.task_id.task_name}/t_new/{d.id}', expect_content={'modified': 2, 'conflicts': 0})
        self.get(f'/renameAnswers/{p.task_id.task_name}/t_new/{d.id}',
                 expect_status=400,
                 expect_content={"error": "The new name conflicts with 2 other answers with the same task name."})
        self.assertEqual(0, Answer.query.filter_by(task_id=p.task_id.doc_task).count())
        self.assertEqual(2, Answer.query.filter_by(task_id=f'{d.id}.t_new').count())
        self.post_answer(p2.type, p2.task_id.doc_task, [True, True, False])
        self.get(f'/renameAnswers/t_new/{p2.task_id.task_name}/{d.id}',
                 expect_status=400,
                 expect_content={"error": "The new name conflicts with 1 other answers with the same task name."})
        self.get(f'/renameAnswers/t_new/t_new2/{d.id}', expect_content={'modified': 2, 'conflicts': 0})
        self.get(f'/renameAnswers/t_new2/{p2.task_id.task_name}/{d.id}',
                 expect_status=400,
                 expect_content={"error": "The new name conflicts with 1 other answers with the same task name."})
        self.get(f'/renameAnswers/t_new2/{p2.task_id.task_name}/{d.id}',
                 query_string={'force': 'true'}, expect_content={'modified': 2, 'conflicts': 1})
        self.assertEqual(3, Answer.query.filter_by(task_id=p2.task_id.doc_task).count())
        self.login_test2()
        self.get(f'/renameAnswers/t_new/{p2.task_id.task_name}/{d.id}', expect_status=403)

    def test_timtable_nonexistent_route(self):
        """Calling non-existent timTable route won't result in an infinite request loop."""
        self.get('/timTable/addDatablockColumn', expect_status=404)

    def test_save_teachers_fix(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
``` {#t plugin="mmcq"}
stem: ""
choices:
  -
    correct: true
    reason: ""
    text: ""
```""")
        grant_view_access(self.test_user_2.get_personal_group().id, d.id)
        did = d.id
        self.login_test2()
        a = self.post_answer('mmcq', f'{did}.t', [False, False, False])
        self.login_test1()
        aid = a['savedNew']
        self.post_answer('mmcq', f'{did}.t', [False, False, True],
                         save_teacher=True,
                         teacher=True,
                         user_id=self.test_user_2.id,
                         answer_id=aid)
        a: Answer = Answer.query.get(aid)
        self.assertEqual(2, len(a.users_all))

    def test_pali(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {plugin=pali #t}
needed_len: 6
        """)
        e = self.get(d.url, as_tree=True).cssselect('pali-runner')
        self.assertTrue(e)
        a = self.post_answer(plugin_type='pali', task_id=f'{d.id}.t', user_input={'userwordx': 'aaaa'})
        self.assertEqual('userword: Missing data for required field.',
                         html.fromstring(a['web']['error']).cssselect('li')[0].text)
        a = self.post_answer(plugin_type='pali', task_id=f'{d.id}.t', user_input={'paliOK': True, 'userword': 'aaaa'})
        self.assertEqual({'error': 'Wrong length', 'result': 'saved'}, a['web'])
        a = self.post_answer(plugin_type='pali', task_id=f'{d.id}.t', user_input={'paliOK': True, 'userword': 'aaaaaa'})
        self.assertEqual({'result': 'saved'}, a['web'])

        p = d.document.get_paragraphs()[0]
        p.set_markdown("""needed_len: 6\nlazy: true""")
        p.save()

        h = self.get(d.url, as_tree=True)
        e = h.cssselect('pali-runner')
        self.assertFalse(e)
        e = h.cssselect('.csRunDiv')
        self.assertTrue(e)

    def test_hide_names(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {plugin=pali #t}
""")
        task_id = f'{d.id}.t'
        a = self.post_answer(plugin_type='pali', task_id=task_id, user_input={'userword': 'aaaaaa', 'paliOK': True})
        self.mark_as_read(d, d.document.get_paragraphs()[0].get_id())
        r = self.get(d.get_url_for_view('teacher'), query_string={'hide_names': True})
        self.assertNotIn('users = [{"email": "test1@example.com"', r)
        r = self.get(d.get_url_for_view('teacher'))
        self.assertNotIn('users = [{"email": "test1@example.com"', r)

        answer_list = self.get_task_answers(task_id)
        self.assertEqual([{'content': '{"userword": "aaaaaa"}',
                           'last_points_modifier': None,
                           'points': 1.0,
                           'task_id': task_id,
                           'users': [{'email': 'user2@example.com',
                                      'id': 2,
                                      'name': 'user2',
                                      'real_name': 'User 2'}],
                           'valid': True}], self.exclude_answered_on_id(answer_list))
        self.get(f'/getTaskUsers/{task_id}',
                 expect_content=[{'email': 'user2@example.com',
                                  'id': 2,
                                  'name': 'user2',
                                  'real_name': 'User 2'}])
        self.get(f'/read/stats/{d.path}',
                 expect_content=[{'any_of_phs': 0,
                                  'click_par': 0,
                                  'click_red': 1,
                                  'hover_par': 0,
                                  'on_screen': 0,
                                  'username': 'user'}])

        r = self.get(d.get_url_for_view('teacher'), query_string={'hide_names': False})
        self.assertIn('users = [{"email": "test1@example.com"', r)
        r = self.get(d.get_url_for_view('teacher'))
        self.assertIn('users = [{"email": "test1@example.com"', r)

    def make_base64(self, d: dict):
        """Converts the given dict to a base64-encoded JSON string."""
        return base64.b64encode(json.dumps(d, sort_keys=True).encode()).decode()

    def test_inline_plugins(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {defaultplugin=pali id=Lm7y6R7n5XIb}
*Hello* {#t1}, {#tx:nonexistent} and {#t2} $x$

#- {defaultplugin=pali math_type=svg id=spOMcE20X2aX}
Hi {#t3} $x$

#- {defaultplugin=pali id=Se0s8FDLbhOp}
{#t4 header: hi, footer: ho}
        """)
        r = self.get(d.url, as_tree=True)
        e = r.cssselect('.par')[0]
        expected_json = self.create_plugin_json(
            d,
            't1',
            'Lm7y6R7n5XIb',
        )
        expected_json2 = self.create_plugin_json(
            d,
            't2',
            'Lm7y6R7n5XIb',
        )
        self.assert_same_html(e, f"""
<div class="par" id="Lm7y6R7n5XIb" t="LTB4NDMxYzFjN2M=" attrs='{{"defaultplugin": "pali"}}'>
<div class="parContent">
                <em>Hello</em> <span id="{d.id}.t1.Lm7y6R7n5XIb" data-plugin="/pali" class="pluginpali inlineplugin"><pali-runner json="{self.make_base64(expected_json)}"></pali-runner></span>, <span class="error">Plugin nonexistent error: Plugin does not exist.</span> and <span id="{d.id}.t2.Lm7y6R7n5XIb" data-plugin="/pali" class="pluginpali inlineplugin"><pali-runner json="{self.make_base64(expected_json2)}"></pali-runner></span>
            <span class="math inline">\(x\)</span>
            </div>
<div class="editline" title="Click to edit this paragraph"></div>
<div class="readline" title="Click to mark this paragraph as read"></div>
</div>
""")
        a = self.post_answer_no_abdata(
            plugin_type='pali', task_id=f'{d.id}.t2',
            user_input={'userword': 'aaaaaa'},
        )
        aid = a['savedNew']
        self.assertEqual({'savedNew': aid, 'web': {'result': 'saved'}}, a)
        self.assertIsInstance(aid, int)

        r = self.get(d.url, as_tree=True)
        e = r.cssselect('.par')[0]
        s = {'userword': 'aaaaaa'}
        expected_json2 = self.create_plugin_json(
            d,
            't2',
            'Lm7y6R7n5XIb',
            info={
                "current_user_id": "testuser1",
                "earlier_answers": 1,
                "look_answer": False,
                "max_answers": None,
                "user_id": "testuser1",
                "valid": True,
            },
            state=s,
            toplevel=s,
        )
        self.assert_same_html(e, f"""
<div class="par" id="Lm7y6R7n5XIb" t="LTB4NDMxYzFjN2M=" attrs='{{"defaultplugin": "pali"}}'>
<div class="parContent">
                <em>Hello</em> <span id="{d.id}.t1.Lm7y6R7n5XIb" data-plugin="/pali" class="pluginpali inlineplugin"><pali-runner json="{self.make_base64(
    expected_json)}"></pali-runner></span>, <span class="error">Plugin nonexistent error: Plugin does not exist.</span> and <span id="{d.id}.t2.Lm7y6R7n5XIb" data-answer-id="{aid}" data-plugin="/pali" class="pluginpali inlineplugin"><pali-runner json="{self.make_base64(
    expected_json2)}"></pali-runner></span>
<span class="math inline">\(x\)</span>
            </div>
<div class="editline" title="Click to edit this paragraph"></div>
<div class="readline" title="Click to mark this paragraph as read"></div>
</div>
        """)
        expected_json = self.create_plugin_json(
            d,
            't3',
            'spOMcE20X2aX',
        )
        self.assert_same_html(r.cssselect('.par')[1], f"""
<div class="par" id="spOMcE20X2aX" t="LTB4NTRjM2E3ZmE=" attrs='{{"defaultplugin": "pali", "math_type": "svg"}}'>
<div class="parContent">
                Hi
<span id="{d.id}.t3.spOMcE20X2aX" class="pluginpali inlineplugin" data-plugin="/pali">
<pali-runner json="{self.make_base64(expected_json)}"></pali-runner>
</span>
<span class="mathp inline"><img style="width:0.80327em; vertical-align:-0.06000em" src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0nMS4wJyBlbmNvZGluZz0nVVRGLTgnPz4KPCEtLSBUaGlzIGZpbGUgd2FzIGdlbmVyYXRlZCBieSBkdmlzdmdtIDIuNCAtLT4KPHN2ZyBoZWlnaHQ9JzUuMjg5NDZwdCcgdmVyc2lvbj0nMS4xJyB2aWV3Qm94PSctMC41MDAwMDIgLTQuNzg5NDU4IDYuNjkzOTIyIDUuMjg5NDYnIHdpZHRoPSc2LjY5MzkyMnB0JyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHhtbG5zOnhsaW5rPSdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJz4KPGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj48IVtDREFUQVtwYXRoIHtzdHJva2U6IGN1cnJlbnRDb2xvcjtzdHJva2Utd2lkdGg6IDAuMDVwdDt9XV0+PC9zdHlsZT48cGF0aCBkPSdNMy4zMjc1MjIgLTMuMDA4NzE3QzMuMzg3Mjk4IC0zLjI2Nzc0NiAzLjYxNjQzOCAtNC4xODQzMDkgNC4zMTM4MjMgLTQuMTg0MzA5QzQuMzYzNjM2IC00LjE4NDMwOSA0LjYwMjc0IC00LjE4NDMwOSA0LjgxMTk1NSAtNC4wNTQ3OTVDNC41MzMwMDEgLTQuMDA0OTgxIDQuMzMzNzQ4IC0zLjc1NTkxNSA0LjMzMzc0OCAtMy41MTY4MTJDNC4zMzM3NDggLTMuMzU3NDEgNC40NDMzMzcgLTMuMTY4MTIgNC43MTIzMjkgLTMuMTY4MTJDNC45MzE1MDcgLTMuMTY4MTIgNS4yNTAzMTEgLTMuMzQ3NDQ3IDUuMjUwMzExIC0zLjc0NTk1M0M1LjI1MDMxMSAtNC4yNjQwMSA0LjY2MjUxNiAtNC40MDM0ODcgNC4zMjM3ODYgLTQuNDAzNDg3QzMuNzQ1OTUzIC00LjQwMzQ4NyAzLjM5NzI2IC0zLjg3NTQ2NyAzLjI3NzcwOSAtMy42NDYzMjZDMy4wMjg2NDMgLTQuMzAzODYxIDIuNDkwNjYgLTQuNDAzNDg3IDIuMjAxNzQzIC00LjQwMzQ4N0MxLjE2NTYyOSAtNC40MDM0ODcgMC41OTc3NTggLTMuMTE4MzA2IDAuNTk3NzU4IC0yLjg2OTI0QzAuNTk3NzU4IC0yLjc2OTYxNCAwLjY5NzM4NSAtMi43Njk2MTQgMC43MTczMSAtMi43Njk2MTRDMC43OTcwMTEgLTIuNzY5NjE0IDAuODI2ODk5IC0yLjc4OTUzOSAwLjg0NjgyNCAtMi44NzkyMDNDMS4xODU1NTQgLTMuOTM1MjQzIDEuODQzMDg4IC00LjE4NDMwOSAyLjE4MTgxOCAtNC4xODQzMDlDMi4zNzExMDggLTQuMTg0MzA5IDIuNzE5ODAxIC00LjA5NDY0NSAyLjcxOTgwMSAtMy41MTY4MTJDMi43MTk4MDEgLTMuMjA3OTcgMi41NTA0MzYgLTIuNTQwNDczIDIuMTgxODE4IC0xLjE0NTcwNEMyLjAyMjQxNiAtMC41MjgwMiAxLjY3MzcyNCAtMC4xMDk1ODkgMS4yMzUzNjcgLTAuMTA5NTg5QzEuMTc1NTkyIC0wLjEwOTU4OSAwLjk0NjQ1MSAtMC4xMDk1ODkgMC43MzcyMzUgLTAuMjM5MTAzQzAuOTg2MzAxIC0wLjI4ODkxNyAxLjIwNTQ3OSAtMC40OTgxMzIgMS4yMDU0NzkgLTAuNzc3MDg2QzEuMjA1NDc5IC0xLjA0NjA3NyAwLjk4NjMwMSAtMS4xMjU3NzggMC44MzY4NjIgLTEuMTI1Nzc4QzAuNTM3OTgzIC0xLjEyNTc3OCAwLjI4ODkxNyAtMC44NjY3NSAwLjI4ODkxNyAtMC41NDc5NDVDMC4yODg5MTcgLTAuMDg5NjY0IDAuNzg3MDQ5IDAuMTA5NTg5IDEuMjI1NDA1IDAuMTA5NTg5QzEuODgyOTM5IDAuMTA5NTg5IDIuMjQxNTk0IC0wLjU4Nzc5NiAyLjI3MTQ4MiAtMC42NDc1NzJDMi4zOTEwMzQgLTAuMjc4OTU0IDIuNzQ5Njg5IDAuMTA5NTg5IDMuMzQ3NDQ3IDAuMTA5NTg5QzQuMzczNTk5IDAuMTA5NTg5IDQuOTQxNDY5IC0xLjE3NTU5MiA0Ljk0MTQ2OSAtMS40MjQ2NThDNC45NDE0NjkgLTEuNTI0Mjg0IDQuODUxODA2IC0xLjUyNDI4NCA0LjgyMTkxOCAtMS41MjQyODRDNC43MzIyNTQgLTEuNTI0Mjg0IDQuNzEyMzI5IC0xLjQ4NDQzMyA0LjY5MjQwMyAtMS40MTQ2OTVDNC4zNjM2MzYgLTAuMzQ4NjkyIDMuNjg2MTc3IC0wLjEwOTU4OSAzLjM2NzM3MiAtMC4xMDk1ODlDMi45Nzg4MjkgLTAuMTA5NTg5IDIuODE5NDI3IC0wLjQyODM5NCAyLjgxOTQyNyAtMC43NjcxMjNDMi44MTk0MjcgLTAuOTg2MzAxIDIuODc5MjAzIC0xLjIwNTQ3OSAyLjk4ODc5MiAtMS42NDM4MzZMMy4zMjc1MjIgLTMuMDA4NzE3WicgaWQ9J2cwLTEyMCcvPgo8L2RlZnM+CjxnIGlkPSdwYWdlMSc+Cjx1c2UgeD0nMCcgeGxpbms6aHJlZj0nI2cwLTEyMCcgeT0nMCcvPgo8L2c+Cjwvc3ZnPg==" title="x"></span></div>
            
<div class="editline" title="Click to edit this paragraph"></div>
<div class="readline" title="Click to mark this paragraph as read"></div>
</div>
        """)

        expected_json = self.create_plugin_json(
            d,
            't4',
            'Se0s8FDLbhOp',
            markup={"header": "hi",
                    "footer": "ho", }
        )
        self.assert_same_html(r.cssselect('.par')[2], f"""
<div class="par" id="Se0s8FDLbhOp" t="LTB4MzJmOWU4MGI=" attrs='{{"defaultplugin": "pali"}}'>
<div class="parContent">
<span id="{d.id}.t4.Se0s8FDLbhOp" class="pluginpali inlineplugin" data-plugin="/pali">
<pali-runner json="{self.make_base64(expected_json)}"></pali-runner>
</span></div>
<div class="editline" title="Click to edit this paragraph"></div>
<div class="readline" title="Click to mark this paragraph as read"></div>
</div>
                """)

        a = self.post_answer_no_abdata(
            plugin_type='pali',
            task_id=f'{d.id}.t5',
            user_input={'userword': 'aaaaaa'},
            expect_content={},
        )

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
            "user_id": "testuser1",
            "userPrint": False
        }
        return expected_json

    def test_inline_plugin_no_html_escape(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {defaultplugin=pali id=a3Xuyg1PF1l1}
{#t5 initword: }
        """)
        r = self.get(d.url, as_tree=True)
        # Make sure Dumbo won't escape plugin's error HTML.
        self.assert_same_html(r.cssselect('.parContent')[0], f"""
<div class="parContent">
    <span id="{d.id}.t5.a3Xuyg1PF1l1" class="pluginpali inlineplugin" data-plugin="/pali">
        <div class="pluginError">
            The following fields have invalid values:
            <ul>
                <li>
                    initword: Field may not be null.
                </li>
            </ul>
        </div>
    </span>
</div>
        """)

    def assert_plugin_json(self, e: HtmlElement, content: Dict[str, Any]):
        b64str = e.attrib['json']
        json_str = base64.b64decode(b64str)
        self.assertEqual(content, json.loads(json_str))

    def test_taskid_reference(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {defaultplugin=pali id=a3Xuyg1PF1l1}
{#t5}
        """)
        self.post_answer_no_abdata(
            plugin_type='pali',
            task_id=f'{d.id}.t5',
            user_input={'userword': 'bbbb'},
        )

        d2 = self.create_doc(initial_par=f"""
#- {{defaultplugin=pali}}
{{#{d.id}.t5}}
                """)
        r = self.get(d2.url, as_tree=True)
        s = {'userword': 'bbbb'}
        self.assert_plugin_json(r.cssselect('.parContent pali-runner')[0],
                                self.create_plugin_json(
                                    d, 't5', state=s, toplevel=s,
                                    info={'current_user_id': 'testuser1',
                                          'earlier_answers': 1,
                                          'look_answer': False,
                                          'max_answers': None,
                                          'user_id': 'testuser1',
                                          'valid': True},
                                ))
        r = self.post_answer('pali', f'{d.id}.t5', {'userword': 'xxx'},
                             ref_from=[d2.id, d2.document.get_paragraphs()[0].get_id()])
        self.check_ok_answer(r)

        self.login_test2()
        d3 = self.create_doc(initial_par=f"""
#- {{defaultplugin=pali}}
{{#{d.id}.t5}}

#- {{#{d.id}.t5 plugin=pali}}

#- {{#1234.t5 plugin=pali}}
""")
        self.post_answer(
            'pali',
            f'{d.id}.t5',
            user_input={'userword': 'xxx'},
            ref_from=[d3.id, d3.document.get_paragraphs()[0].get_id()],
            expect_status=403,
        )
        r = self.get(d3.url, as_tree=True)
        access_err = 'Plugin pali error: Task id refers to another document, ' \
                     'but you do not have access to that document.'
        self.assert_content(
            r,
            [access_err,
             access_err,
             'Plugin pali error: Task id refers to a non-existent document.'
             ],
        )

    def test_taskid_reference_teacher(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {plugin=pali #t}
        """)
        d_id = d.id
        grant_view_access(self.get_test_user_2_group_id(), d.id)
        self.login_test2()
        d2 = self.create_doc(initial_par=f"""
#- {{plugin=pali #{d_id}.t}}
        """)
        r = self.get(d2.get_url_for_view('teacher'), as_tree=True)
        alert: HtmlElement = r.cssselect('.alert-info')[0]
        self.assertEqual(f'You do not have full access to the following tasks: {d_id}.t', alert.text_content().strip())

    def test_inline_plugin_error_html_no_p(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {defaultplugin="pali" id=a3Xuyg1PF1l1}
a {#x initword: } b
        """)
        r = self.get(d.url, as_tree=True)
        self.assert_same_html(r.cssselect('.parContent')[0], f"""
<div class="parContent">
    a
    <span id="{d.id}.x.a3Xuyg1PF1l1" class="pluginpali inlineplugin" data-plugin="/pali">
        <div class="pluginError">
            The following fields have invalid values:
            <ul>
                <li>
                    initword: Field may not be null.
                </li>
            </ul>
        </div>
    </span>
    b
</div>""")

    def test_inline_plugin_sanitize(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {defaultplugin=pali}
<script>alert('hello')</script>
        """)
        r = self.get(d.url, as_tree=True)
        self.assertFalse(r.cssselect('.parContent script'))
