from timApp.item.tag import TagType
from timApp.tests.server.timroutetest import TimRouteTest


class SearchTest(TimRouteTest):

    def test_search(self):
        u = self.test_user_1
        self.make_admin(u)
        self.login_test1()
        text_to_search = 'cat'
        text_in_document = 'House cats like to hunt too.'
        d = self.create_doc(initial_par=text_in_document)
        self.get(f'search/createContentFile')
        print(d.id)
        url = f'search?caseSensitive=false&folder=&ignorePlugins=false&query={text_to_search}&regex=false'
        self.get(url, expect_status=200, expect_content={'incomplete_search_reason': '',
                                                         'errors': [],
                                                         'results': [{'doc': {'id': d.id,
                                                                              'isFolder': False,
                                                                              'location': d.location,
                                                                              'modified': 'just now',
                                                                              'name': d.short_name,
                                                                              'owner': {
                                                                                  'id': self.get_test_user_1_group_id(),
                                                                                  'name': u.name},
                                                                              'path': d.path,
                                                                              'public': True,
                                                                              'rights': {'browse_own_answers': True,
                                                                                         'can_comment': True,
                                                                                         'can_mark_as_read': True,
                                                                                         'editable': True,
                                                                                         'manage': True,
                                                                                         'owner': True,
                                                                                         'see_answers': True,
                                                                                         'teacher': True},
                                                                              'title': d.title,
                                                                              'unpublished': True},
                                                                      'incomplete': False,
                                                                      'num_par_results': 1,
                                                                      'num_title_results': 0,
                                                                      'par_results': [{'num_results': 1,
                                                                                       'par_id': "b846fS0dIKsF",
                                                                                       'preview': 'House cats like to hunt too.',
                                                                                       'results': [{'match_end': 9,
                                                                                                    'match_start': 6,
                                                                                                    'match_word': 'cat'}]}],
                                                                      'title_results': []}],
                                                         'title_result_count': 0,
                                                         'word_result_count': 1})

    def test_too_short_search(self):
        u = self.test_user_1
        self.make_admin(u)
        self.login_test1()
        self.create_doc(initial_par="There's a match inside, but it can't be searched.")
        text_to_search = 'a'
        self.get(f'search/createContentFile')
        url = f'search?folder=&query={text_to_search}'
        self.get(url, expect_status=400,
                 expect_content={'error': 'Search text must be at least 3 character(s) long with whitespace stripped.'})

    def test_not_found_search(self):
        u = self.test_user_1
        self.make_admin(u)
        self.login_test1()
        self.create_doc(initial_par="I contain plenty of text but not the one you are searching!")
        self.get(f'search/createContentFile')
        text_to_search = 'Cannot be found anywhere'
        url = f'search?folder=&query={text_to_search}'
        self.get(url, expect_status=200, expect_content={'incomplete_search_reason': '',
                                                         'errors': [],
                                                         'results': [],
                                                         'title_result_count': 0,
                                                         'word_result_count': 0})

    def test_case_sensitive_search(self):
        u = self.test_user_1
        self.make_admin(u)
        self.login_test1()
        text_to_search = 'Text to search'
        case_sensitive = True
        self.create_doc(initial_par=text_to_search)
        self.get(f'search/createContentFile')
        text_to_search_upper = 'TEXT TO SEARCH'
        url = f'search?caseSensitive={case_sensitive}&folder=&query={text_to_search_upper}'
        self.get(url, expect_status=200, expect_content={'incomplete_search_reason': '',
                                                         'errors': [],
                                                         'results': [],
                                                         'title_result_count': 0,
                                                         'word_result_count': 0})

    def test_search_without_view_rights(self):
        text_to_search = 'secret'
        url = f'search?folder=&query={text_to_search}'

        self.make_admin(self.test_user_1)
        self.login_test1()
        d = self.create_doc(initial_par='Super secret things.')
        self.get(f'search/createContentFile')
        self.login_test2()
        self.test_user_2.remove_access(d.id, 'view')
        self.get(url, expect_status=200, expect_content={'incomplete_search_reason': '',
                                                         'errors': [],
                                                         'results': [],
                                                         'title_result_count': 0,
                                                         'word_result_count': 0})

    def test_search_plugin(self):
        text_to_search = 'answer'
        plugin_md = """``` {plugin="test"}
        question: What cats like the most?
        answer: Catnip.
        ```"""
        self.make_admin(self.test_user_1)
        self.login_test1()
        d = self.create_doc(initial_par=plugin_md)
        self.get(f'search/createContentFile')
        self.test_user_1.grant_access(d.id, 'edit')
        self.get(f'search?folder=&query={text_to_search}', expect_status=200,
                 expect_content={'incomplete_search_reason': '',
                                 'errors': [],
                                 'results': [{'doc': {'id': d.id,
                                                      'isFolder': False,
                                                      'location': d.location,
                                                      'modified': 'just now',
                                                      'name': d.short_name,
                                                      'owner': {
                                                          'id': self.get_test_user_1_group_id(),
                                                          'name': self.test_user_1.name},
                                                      'path': d.path,
                                                      'public': True,
                                                      'rights': {'browse_own_answers': True,
                                                                 'can_comment': True,
                                                                 'can_mark_as_read': True,
                                                                 'editable': True,
                                                                 'manage': True,
                                                                 'owner': True,
                                                                 'see_answers': True,
                                                                 'teacher': True},
                                                      'title': d.title,
                                                      'unpublished': True},
                                              'incomplete': False,
                                              'num_par_results': 1,
                                              'num_title_results': 0,
                                              'par_results': [{'num_results': 1,
                                                               'par_id': '4mayw3MVytjV',
                                                               'preview': '...stion: What cats like the '
                                                                          'most?         answer: '
                                                                          'Catnip.         ``` ```',
                                                               'results': [{'match_end': 61,
                                                                            'match_start': 55,
                                                                            'match_word': 'answer'}]}],
                                              'title_results': []}],
                                 'title_result_count': 0,
                                 'word_result_count': 1})

        self.get(f'search?folder=&query={text_to_search}&ignorePlugins=True', expect_status=200,
                 expect_content={'incomplete_search_reason': '',
                                 'errors': [],
                                 'results': [],
                                 'title_result_count': 0,
                                 'word_result_count': 0})

        self.login_test2()
        self.test_user_2.grant_access(d.id, 'view')
        self.get(f'search?folder=&query={text_to_search}', expect_status=200,
                 expect_content={'incomplete_search_reason': '',
                                 'errors': [],
                                 'results': [],
                                 'title_result_count': 0,
                                 'word_result_count': 0})

    def test_title_search(self):
        u = self.test_user_1
        self.login_test1()
        d = self.create_doc()
        search_titles = True
        text_to_search = d.title
        url = f'search/titles?caseSensitive=false&folder=&query={text_to_search}'
        self.get(url, expect_status=200, expect_content={'incomplete_search_reason': '',
                                                         'errors': [],
                                                         'results': [{'doc': {'id': d.id,
                                                                              'isFolder': False,
                                                                              'location': d.location,
                                                                              'modified': 'just now',
                                                                              'name': d.short_name,
                                                                              'owner': {
                                                                                  'id': self.get_test_user_1_group_id(),
                                                                                  'name': u.name},
                                                                              'path': d.path,
                                                                              'public': True,
                                                                              'rights': {'browse_own_answers': True,
                                                                                         'can_comment': True,
                                                                                         'can_mark_as_read': True,
                                                                                         'editable': True,
                                                                                         'manage': True,
                                                                                         'owner': True,
                                                                                         'see_answers': True,
                                                                                         'teacher': True},
                                                                              'title': d.title,
                                                                              'unpublished': True},
                                                                      'incomplete': False,
                                                                      'num_par_results': 0,
                                                                      'num_title_results': 1,
                                                                      'par_results': [],
                                                                      'title_results': [{'num_results': 1,
                                                                                         'results': [
                                                                                             {'match_end': len(d.title),
                                                                                              'match_start': 0,
                                                                                              'match_word': d.title}]}]}],
                                                         'title_result_count': 1,
                                                         'word_result_count': 0})

    def test_tag_search(self):
        u = self.test_user_1
        self.login_test1()
        d = self.create_doc()
        tags = ["dog", "dog2", "cat"]
        self.json_post(f'/tags/add/{d.path}', {'tags': [{'name': tags[0], 'expires': None, 'type': TagType.Regular},
                                                        {'name': tags[1], 'expires': None, 'type': TagType.Regular},
                                                        {'name': tags[2], 'expires': None, 'type': TagType.Regular}]})

        tag_to_search = 'dog'
        url = f'search/tags?caseSensitive=true&folder=&query={tag_to_search}&regex=false'
        self.get(url, expect_status=200, expect_content={'errors': [],
                                                         'incomplete_search_reason': '',
                                                         'results': [{'doc': {'id': d.id,
                                                                              'isFolder': False,
                                                                              'location': d.location,
                                                                              'modified': 'just now',
                                                                              'name': d.short_name,
                                                                              'owner': {
                                                                                  'id': self.get_test_user_1_group_id(),
                                                                                  'name': u.name},
                                                                              'path': d.path,
                                                                              'public': True,
                                                                              'rights': {'browse_own_answers': True,
                                                                                         'can_comment': True,
                                                                                         'can_mark_as_read': True,
                                                                                         'editable': True,
                                                                                         'manage': True,
                                                                                         'owner': True,
                                                                                         'see_answers': True,
                                                                                         'teacher': True},
                                                                              'tags': [{'block_id': d.id,
                                                                                        'expires': None,
                                                                                        'name': tags[0],
                                                                                        'type': TagType.Regular.value},
                                                                                       {'block_id': d.id,
                                                                                        'expires': None,
                                                                                        'name': tags[1],
                                                                                        'type': TagType.Regular.value},
                                                                                       {'block_id': d.id,
                                                                                        'expires': None,
                                                                                        'name': tags[2],
                                                                                        'type': TagType.Regular.value}],
                                                                              'title': d.title,
                                                                              'unpublished': True},
                                                                      'matching_tags': [{'block_id': d.id,
                                                                                         'expires': None,
                                                                                         'name': tags[0],
                                                                                         'type': TagType.Regular.value},
                                                                                        {'block_id': d.id,
                                                                                         'expires': None,
                                                                                         'name': tags[1],
                                                                                         'type': TagType.Regular.value}],
                                                                      'num_results': 2}],
                                                         'tag_result_count': 2})
