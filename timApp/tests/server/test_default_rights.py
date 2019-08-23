from operator import itemgetter

from dateutil import parser

from timApp.auth.accesstype import AccessType
from timApp.auth.auth_models import BlockAccess
from timApp.document.specialnames import TEMPLATE_FOLDER_NAME
from timApp.tests.server.timroutetest import TimRouteTest
from timApp.item.block import BlockType
from timApp.document.docentry import DocEntry
from timApp.folder.folder import Folder
from timApp.user.usergroup import UserGroup
from timApp.user.special_group_names import KORPPI_GROUPNAME
from timApp.timdb.sqa import db
from timApp.user.users import get_rights_holders, get_default_rights_holders
from timApp.user.userutils import get_anon_group_id, grant_default_access, default_right_paths


class DefaultRightTest(TimRouteTest):

    def test_document_default_rights(self):
        self.login_test1()
        doc = self.create_doc().document
        timdb = self.get_db()
        docentry = DocEntry.query.filter_by(id=doc.doc_id).one()
        folder: Folder = docentry.parent
        folder_owner_id = folder.owner.id
        korppi_id = UserGroup.get_korppi_group().id
        users_folder = Folder.find_by_path('users')
        grant_default_access([korppi_id], users_folder.id, 'view',
                             BlockType.Document)

        # Make sure an exception won't be thrown if trying to add a right again
        acs = grant_default_access([korppi_id], users_folder.id, 'view',
                                   BlockType.Document)
        db.session.commit()
        anon_id = UserGroup.get_anonymous_group().id
        for obj_type_str in ('document', 'folder'):
            obj_type = BlockType.from_str(obj_type_str)
            def_rights = get_default_rights_holders(folder.id, obj_type)
            self.assertListEqual([], def_rights)

            rights_doc = folder.get_document(default_right_paths[obj_type])
            self.assertIsNone(rights_doc)

            self.json_put(
                f'/defaultPermissions/{obj_type_str}/add/{folder.id}/{"Anonymous users;testuser2"}/{"view"}',
                {'type': 'always'},
                expect_content=self.ok_resp)

            def_rights = self.get(f'/defaultPermissions/{obj_type_str}/get/{folder.id}',
                                  expect_status=200)
            def_rights['grouprights'] = convert_to_old_format(def_rights['grouprights'])
            expected_default_rights = [{'access_name': 'view',
                                        'access_type': 1,
                                        'fullname': 'Test user 2',
                                        'gid': self.get_test_user_2_group_id(),
                                        'name': 'testuser2',
                                        'duration': None,
                                        'accessible_from': def_rights['grouprights'][0]['accessible_from'],
                                        'accessible_to': None,
                                        'duration_from': None,
                                        'duration_to': None},
                                       {'access_name': 'view',
                                        'access_type': 1,
                                        'fullname': None,
                                        'gid': anon_id,
                                        'name': 'Anonymous users',
                                        'duration': None,
                                        'accessible_from': def_rights['grouprights'][1]['accessible_from'],
                                        'accessible_to': None,
                                        'duration_from': None,
                                        'duration_to': None}]
            expected_default_rights = sorted(expected_default_rights, key=itemgetter('gid'))
            self.assertDictEqual(
                {'grouprights': expected_default_rights},
                def_rights)
            for d in expected_default_rights:
                d['accessible_from'] = parser.parse(d['accessible_from'])
                d['accessible_to'] = parser.parse(d['accessible_to']) if d['accessible_to'] else None
            rights_doc = folder.get_document(default_right_paths[obj_type])
            self.assertIsNotNone(rights_doc)
            t_f = folder.get_all_folders()[0]
            self.assertEqual(TEMPLATE_FOLDER_NAME, t_f.short_name)
            self.assertEqual(folder_owner_id, t_f.owner.id)

            if obj_type == BlockType.Document:
                new_doc = self.create_doc().document
                new_item_rights = get_rights_holders(new_doc.doc_id)
                expected_default_rights.append(
                    {'gid': korppi_id,
                     'name': KORPPI_GROUPNAME,
                     'access_type': 1,
                     'fullname': None,
                     'access_name': 'view',
                     'duration': None,
                     'accessible_from': acs[0].accessible_from,
                     'accessible_to': None,
                     'duration_from': None,
                     'duration_to': None
                     })
            elif obj_type == BlockType.Folder:
                f = self.create_folder(self.current_user.get_personal_folder().path + '/asd', 'folder')
                new_item_rights = get_rights_holders(f['id'])
            else:
                raise Exception('error in test: object type should be document or folder')
            new_item_rights = convert_to_old_format(new_item_rights)
            new_item_rights = [right for right in new_item_rights if right['access_name'] != 'owner']
            self.assertListEqual(sorted(expected_default_rights, key=itemgetter('gid', 'access_type')),
                                 sorted(new_item_rights, key=itemgetter('gid', 'access_type')))
            self.json_put(f'/defaultPermissions/{obj_type_str}/remove/{folder.id}/{get_anon_group_id()}/{"view"}',
                          expect_content=self.ok_resp)
            def_rights = get_default_rights_holders(folder.id, obj_type)
            expected_default_rights = [r for r in expected_default_rights if r['gid'] not in (anon_id, korppi_id)]
            self.assertEqual(expected_default_rights, convert_to_old_format(def_rights))


def convert_to_old_format(rights):
    return [
        {'gid': r.usergroup_id,
         'name': r.usergroup.name,
         'access_type': r.type,
         'fullname': r.usergroup.personal_user.real_name if hasattr(r.usergroup, 'personal_user') else None,
         'access_name': r.atype.name,
         'duration': r.duration,
         'accessible_from': r.accessible_from,
         'accessible_to': r.accessible_to,
         'duration_from': r.duration_from,
         'duration_to': r.duration_to,
         } if isinstance(r, BlockAccess) else {
            'gid': r['usergroup']['id'],
            'name': r['usergroup']['name'],
            'access_type': r['type'],
            'fullname': r['usergroup']['personal_user']['real_name'] if r['usergroup'].get('personal_user') else None,
            'access_name': AccessType(r['type']).name,
            'duration': r['duration'],
            'accessible_from': r['accessible_from'],
            'accessible_to': r['accessible_to'],
            'duration_from': r['duration_from'],
            'duration_to': r['duration_to'],
        } for r in rights]
