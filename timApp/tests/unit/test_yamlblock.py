import unittest

import yaml
from yaml import YAMLError

from timApp.documentmodel.yamlblock import YamlBlock, MergeStyle, yaml_loader, BlockEndMissingError


class YamlBlockTest(unittest.TestCase):
    md1 = """
macros:
 first: a
 second: b
css: |!!
.red {
    color: red;
}
!!
    """
    md2 = """
macros:
 second: c
 third: d
css: |!!
.blue {
    color: blue;
}
!!
    """
    combined_replace = """
macros:
 first: a
 second: c
 third: d
css: |!!
.blue {
    color: blue;
}
!!
        """
    combined_append = """
macros:
 first: a
 second: c
 third: d
css: |!! a
.red {
    color: red;
}
.blue {
    color: blue;
}
!!
    """

    multiple_multiline = """
a: |!!
test1
!!
b: |??
test2
??
    """

    def test_empty(self):
        self.assertEqual(YamlBlock.from_markdown(''), {})

    def test_parse(self):
        yb = YamlBlock.from_markdown(self.md1)
        self.assertEqual(yb,
                         {'macros': {'first': 'a', 'second': 'b'}, 'css': '.red {\n    color: red;\n}\n'})

    def test_merge_replace(self):
        yb = YamlBlock.from_markdown(self.md1)
        yb2 = YamlBlock.from_markdown(self.md2)
        ybc = YamlBlock.from_markdown(self.combined_replace)
        self.assertEqual(yb.merge_with(yb2), ybc)

        yb2 = YamlBlock.from_markdown(self.md2.replace('|!!', '|!! r'))
        self.assertEqual(yb2.merge_hints, {'css': MergeStyle.Replace})
        self.assertEqual(yb.merge_with(yb2).values, ybc.values)

    def test_merge_replace_if_not_exist(self):
        yb = YamlBlock.from_markdown(self.md1)
        yb2 = YamlBlock.from_markdown(self.md2.replace('|!!', '|!! r?'))
        self.assertEqual(yb2.merge_hints, {'css': MergeStyle.ReplaceIfNotExist})
        self.assertEqual(yb.merge_with(yb2).values, {'css': '.red {\n    color: red;\n}\n',
                                                     'macros': {'first': 'a', 'second': 'c', 'third': 'd'}})

    def test_merge_append(self):
        yb = YamlBlock.from_markdown(self.md1)
        self.assertEqual(yb.merge_hints, {})
        yb2 = YamlBlock.from_markdown(self.md2.replace('|!!', '|!! a'))
        self.assertEqual(yb2.merge_hints, {'css': MergeStyle.Append})
        ybc = YamlBlock.from_markdown(self.combined_append)
        self.assertEqual(yb.merge_with(yb2).values, ybc.values)

    def test_invalid(self):
        invalid = [
            'css: !!!',
            'css: !!',
            """
"a: |!!":|
 asd
 asd
""",
            """
'a: |!!':|
 asd
 asd
""",
        ]
        for md in invalid:
            with self.assertRaises(YAMLError) as cm:
                YamlBlock.from_markdown(md)
            self.assertNotIsInstance(cm.exception, BlockEndMissingError)

    def test_standard(self):
        standard = [
            'css: !',
            'css:',
            'css: ',
            ' css:',
            ' css: ',
            'css: |+\n a\n b',
            'css: |+\n a\n b\n',
            'css: |-\n a\n b',
            'css: |-\n a\n b\n',
        ]
        for md in standard:
            yb = YamlBlock.from_markdown(md)
            self.assertEqual(yb.values, yaml.load(md, yaml_loader), msg=f'\nFailed YAML:\n-----\n{md}\n-----')

    def test_missing_end(self):
        with self.assertRaises(BlockEndMissingError):
            YamlBlock.from_markdown('css: |!!\ntest\n')
        with self.assertRaises(BlockEndMissingError):
            YamlBlock.from_markdown('css: |!!')

    def test_empty_multiline_key(self):
        yb = YamlBlock.from_markdown('css: |!!\n!!')
        self.assertEqual(yb.values, {'css': ''})

    def test_one_char_terminator(self):
        yb = YamlBlock.from_markdown('css: |!\nhello\n!')
        self.assertEqual(yb, {'css': 'hello'})

    def test_multiple_multiline(self):
        yb = YamlBlock.from_markdown(self.multiple_multiline)
        self.assertEqual(yb.values, {'a': 'test1\n', 'b': 'test2\n'})
