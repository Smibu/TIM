from timApp.tests.server.timroutetest import TimRouteTest
from timApp.timdb.docinfo import DocInfo


class IndexTest(TimRouteTest):
    def test_index_one_heading_per_par(self):
        self.login_test1()
        doc = self.create_doc(initial_par="""
# Heading level 1
Lorem ipsum.

---

#-
## Heading level 2
#-
### Heading level 3
#-
# Second heading level 1
        """).document
        self.assertEqual([({'id': 'heading-level-1', 'level': 1, 'text': 'Heading level 1'},
                           [{'id': 'heading-level-2', 'level': 2, 'text': 'Heading level 2'},
                            {'id': 'heading-level-3', 'level': 3, 'text': 'Heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': 'Second heading level 1'},
                           [])], doc.get_index())
        doc = self.create_doc(initial_par="""
# Heading level 1
Lorem ipsum.

---

```
# Not a header
```

#-
# Unnumbered {.nonumber}
#-
## Heading level 2
#-
## Second heading level 2
#-
### Heading level 3
#-
# Second heading level 1
        """).document
        doc.set_settings({'auto_number_headings': True, 'heading_format': {2: "{h1}.{h2}. {text}"}})
        self.assertEqual([({'id': 'heading-level-1', 'level': 1, 'text': '1. Heading level 1'}, []),
                          ({'id': 'unnumbered', 'level': 1, 'text': 'Unnumbered'},
                           [{'id': 'heading-level-2', 'level': 2, 'text': '1.1. Heading level 2'},
                            {'id': 'second-heading-level-2', 'level': 2, 'text': '1.2. Second heading level 2'},
                            {'id': 'heading-level-3', 'level': 3, 'text': '1.2.1 Heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': '2. Second heading level 1'},
                           [])], doc.get_index())

        doc.set_settings({'auto_number_headings': False})
        self.assertEqual([({'id': 'heading-level-1', 'level': 1, 'text': 'Heading level 1'}, []),
                          ({'id': 'unnumbered', 'level': 1, 'text': 'Unnumbered'},
                           [{'id': 'heading-level-2', 'level': 2, 'text': 'Heading level 2'},
                            {'id': 'second-heading-level-2', 'level': 2, 'text': 'Second heading level 2'},
                            {'id': 'heading-level-3', 'level': 3, 'text': 'Heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': 'Second heading level 1'},
                           [])], doc.get_index())

        doc.set_settings({'auto_number_headings': True,
                          'heading_format': {2: '{', 3: '{', 4: '{', 5: '{', 6: '{'}})
        self.assertEqual([({'id': 'heading-level-1', 'level': 1, 'text': '1. Heading level 1'}, []),
                          ({'id': 'unnumbered', 'level': 1, 'text': 'Unnumbered'},
                           [{'id': 'heading-level-2', 'level': 2, 'text': '[ERROR] Heading level 2'},
                            {'id': 'second-heading-level-2', 'level': 2, 'text': '[ERROR] Second heading level 2'},
                            {'id': 'heading-level-3', 'level': 3, 'text': '[ERROR] Heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': '2. Second heading level 1'},
                           [])], doc.get_index())

    def test_index_many_headings_per_par(self):
        self.login_test1()
        doc = self.create_doc(initial_par="""
# Heading level 1
Lorem ipsum.

---

## Heading level 2

## Unnumbered {.nonumber}

### Heading level 3
#-
# Second heading level 1
        """).document
        self.assertEqual([({'id': 'heading-level-1', 'level': 1, 'text': 'Heading level 1'},
                           [{'id': 'heading-level-2', 'level': 2, 'text': 'Heading level 2'},
                            {'id': 'unnumbered', 'level': 2, 'text': 'Unnumbered'},
                            {'id': 'heading-level-3', 'level': 3, 'text': 'Heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': 'Second heading level 1'},
                           [])], doc.get_index())

    def test_index_skip_level(self):
        self.login_test1()
        doc = self.create_doc(initial_par="""
# Heading level 1
Lorem ipsum.

---

### Heading level 3

## Unnumbered {.nonumber}
#-
### Second heading level 3
#-
# Second heading level 1
        """).document
        self.assertEqual([({'id': 'heading-level-1', 'level': 1, 'text': 'Heading level 1'},
                           [{'id': 'heading-level-3', 'level': 3, 'text': 'Heading level 3'},
                            {'id': 'unnumbered', 'level': 2, 'text': 'Unnumbered'},
                            {'id': 'second-heading-level-3', 'level': 3, 'text': 'Second heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': 'Second heading level 1'},
                           [])], doc.get_index())
        ins_pos = doc.get_paragraphs()[0].get_id()
        doc.set_settings({'auto_number_headings': True})
        self.assertEqual([({'id': 'heading-level-1', 'level': 1, 'text': '1. Heading level 1'},
                           [{'id': 'heading-level-3', 'level': 3, 'text': '1.0.1 Heading level 3'},
                            {'id': 'unnumbered', 'level': 2, 'text': 'Unnumbered'},
                            {'id': 'second-heading-level-3', 'level': 3, 'text': '1.0.2 Second heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': '2. Second heading level 1'},
                           [])], doc.get_index())
        self.new_par(doc, """# New heading""", ins_pos)
        self.assertEqual([({'id': 'new-heading', 'level': 1, 'text': '1. New heading'}, []),
                          ({'id': 'heading-level-1', 'level': 1, 'text': '2. Heading level 1'},
                           [{'id': 'heading-level-3', 'level': 3, 'text': '2.0.1 Heading level 3'},
                            {'id': 'unnumbered', 'level': 2, 'text': 'Unnumbered'},
                            {'id': 'second-heading-level-3', 'level': 3, 'text': '2.0.2 Second heading level 3'}]),
                          ({'id': 'second-heading-level-1', 'level': 1, 'text': '3. Second heading level 1'},
                           [])], doc.get_index())

    def test_index_duplicate_headings(self):
        self.login_test1()
        doc = self.create_doc(initial_par="""
# Same

# Same
        """).document
        self.assertEqual([({'id': 'same', 'level': 1, 'text': 'Same'}, []),
                          ({'id': 'same-1', 'level': 1, 'text': 'Same'}, [])], doc.get_index())

        doc = self.create_doc(initial_par="""
# Same
#-
# Same

# Same
#-
# Same
        """).document
        self.assertEqual([({'id': 'same', 'level': 1, 'text': 'Same'}, []),
                          ({'id': 'same-1', 'level': 1, 'text': 'Same'}, []),
                          ({'id': 'same-1-1', 'level': 1, 'text': 'Same'}, []),
                          ({'id': 'same-3', 'level': 1, 'text': 'Same'}, [])], doc.get_index())

    def test_heading_preview(self):
        self.login_test1()
        d = self.create_doc(settings={'auto_number_headings': True}, initial_par='# a\n\n#-\n\n# b\n\n#-\n\n# c')
        self.check_doc_preview(d)

    def test_heading_preview_translation(self):
        self.login_test1()
        orig = self.create_doc(settings={'auto_number_headings': True}, initial_par='# a\n\n#-\n\n# b\n\n#-\n\n# c')
        d = self.create_translation(orig, 'test', 'en')
        self.check_doc_preview(d)

    def test_heading_preview_translation_nonumber(self):
        self.login_test1()
        orig = self.create_doc(settings={'auto_number_headings': True},
                               initial_par='# a\n\n# b {.nonumber}\n\n#-\n\n# c')
        d = self.create_translation(orig, 'test', 'en')
        pars = d.document.get_par_ids()
        self.get_updated_pars(d)

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f'}, json_key='texts', as_tree=True)
        self.assert_content(e, ['3. d\n4. e', '5. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par_next': pars[1]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['1. d\n2. e', '3. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par_next': pars[2]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['2. d\n3. e', '4. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par_next': pars[3]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['2. d\n3. e', '4. f'])

        orig_par = orig.document.get_paragraphs()[2]
        e = self.json_post(f'/preview/{d.id}', {'text': f'# x {{r=tr rp={orig_par.get_id()}}}', 'par': pars[2]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['x'])

    def check_doc_preview(self, d: DocInfo):
        pars = d.document.get_par_ids()
        self.get_updated_pars(d)

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par_next': pars[1]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['1. d\n2. e', '3. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par': pars[1], 'par_next': pars[2]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['1. d\n2. e', '3. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par_next': pars[2]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['2. d\n3. e', '4. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par': pars[2], 'par_next': pars[3]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['2. d\n3. e', '4. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par_next': pars[3]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['3. d\n4. e', '5. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f', 'par': pars[3]},
                           json_key='texts', as_tree=True)
        self.assert_content(e, ['3. d\n4. e', '5. f'])

        e = self.json_post(f'/preview/{d.id}', {'text': '# d\n\n# e\n\n#-\n\n# f'}, json_key='texts', as_tree=True)
        self.assert_content(e, ['4. d\n5. e', '6. f'])
