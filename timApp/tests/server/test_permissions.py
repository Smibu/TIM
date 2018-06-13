from datetime import datetime, timezone, timedelta

from timApp.tests.server.timroutetest import TimRouteTest
from timApp.item.item import Item
from timApp.document.docentry import DocEntry
from timApp.user.usergroup import UserGroup
from timApp.timdb.sqa import db


class PermissionTest(TimRouteTest):

    def test_cannot_remove_ownership(self):
        self.login_test1()
        d = self.create_doc()
        self.assertTrue(self.current_user.has_ownership(d))
        self.json_put(f'/permissions/add/{d.id}/{"testuser1"}/{"owner"}',
                      {'from': datetime.now(tz=timezone.utc) + timedelta(days=1),
                       'type': 'range'},
                      expect_status=403, expect_content={'error': 'You cannot remove ownership from yourself.'})
        db.session.remove()
        d = DocEntry.find_by_id(d.id)
        self.assertTrue(self.current_user.has_ownership(d))
        self.json_put(f'/permissions/remove/{d.id}/{self.get_test_user_1_group_id()}/{"owner"}',
                      expect_status=403)
        db.session.remove()
        d = DocEntry.find_by_id(d.id)
        self.assertTrue(self.current_user.has_ownership(d))

    def test_non_owner_cannot_change_owner(self):
        self.login_test1()
        d = self.create_doc()
        docid = d.id
        self.test_user_2.grant_access(docid, 'manage')
        self.login_test2()
        self.json_put(f'/permissions/add/{docid}/testuser2/owner',
                      {'from': datetime.now(tz=timezone.utc),
                       'type': 'always'},
                      expect_status=403)

    def test_cannot_change_owner_of_personal_folder(self):
        self.login_test1()
        f = self.current_user.get_personal_folder()
        self.json_put(f'/permissions/add/{f.id}/{"testuser2"}/{"owner"}', {},
                      expect_status=403,
                      expect_content={'error': 'You cannot add owners to your personal folder.'})

    def test_trim_whitespace(self):
        self.login_test1()
        f = self.current_user.get_personal_folder()
        self.json_put(f'/permissions/add/{f.id}/{"testuser2  ; testuser3 "}/{"view"}',
                      {'from': datetime.now(tz=timezone.utc),
                       'type': 'always'})
        f = self.current_user.get_personal_folder()
        self.assertTrue(self.test_user_2.has_view_access(f))
        self.assertTrue(self.test_user_3.has_view_access(f))

    def test_permissions_get(self):
        self.login_test1()
        for i in (self.current_user.get_personal_folder(), self.create_doc()):
            self.json_put(f'/permissions/add/{i.id}/testuser2/view',
                          {'from': datetime.now(tz=timezone.utc),
                           'type': 'always'})
            rights = self.get(f'/permissions/get/{i.id}')
            i = Item.find_by_id(i.id)
            self.assertEqual(rights['accesstypes'],
                             [{'id': 1, 'name': 'view'},
                              {'id': 2, 'name': 'edit'},
                              {'id': 3, 'name': 'teacher'},
                              {'id': 4, 'name': 'manage'},
                              {'id': 5, 'name': 'see answers'},
                              {'id': 6, 'name': 'owner'}])
            self.assertEqual(rights['grouprights'],
                             [{'access_name': 'owner',
                               'access_type': 6,
                               'accessible_from': i.block.accesses[
                                   0].accessible_from.isoformat(),
                               'accessible_to': None,
                               'duration': None,
                               'duration_from': None,
                               'duration_to': None,
                               'fullname': 'Test user 1',
                               'gid': 6,
                               'name': 'testuser1'},
                              {'access_name': 'view',
                               'access_type': 1,
                               'accessible_from': str(
                                   i.block.accesses[1].accessible_from.isoformat()),
                               'accessible_to': None,
                               'duration': None,
                               'duration_from': None,
                               'duration_to': None,
                               'fullname': 'Test user 2',
                               'gid': 7,
                               'name': 'testuser2'}, ])

    def test_logged_in_right(self):
        self.login_test1()
        d = self.create_doc()
        self.json_put(f'/permissions/add/{d.id}/Logged-in users/view',
                      {'from': datetime.now(tz=timezone.utc),
                       'type': 'always'})
        self.login_test2()
        self.get(d.url)
        self.login_test1()
        self.json_put(f'/permissions/remove/{d.id}/{UserGroup.get_logged_in_group().id}/view')
        self.login_test2()
        self.get(d.url, expect_status=403)

    def test_recursive_permissions(self):
        self.login_test1()
        paths = ['a', 'b', 'c', 'x/a', 'x/b', 'x/c', 'x/x/a', 'x/x/b', 'x/x/c', ]
        ds = []
        for p in paths:
            d = self.create_doc(self.get_personal_item_path(p))
            ds.append(d)
            t1_f = self.test_user_1.get_personal_folder()
            t1_f_path = t1_f.path
            self.assertFalse(self.test_user_2.has_view_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(t1_f))

        self.get(f"/permissions/removeRecursive/testuser1/owner/{t1_f_path}", expect_status=403)

        self.get(f"/permissions/addRecursive/testuser2;testuser3/view/{t1_f.path}")
        t1_f = self.test_user_1.get_personal_folder()
        for p in paths:
            d = DocEntry.find_by_path(self.get_personal_item_path(p))
            self.assertTrue(self.test_user_2.has_view_access(d))
            self.assertTrue(self.test_user_3.has_view_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(t1_f))

        self.get(f"/permissions/removeRecursive/testuser2/view/{t1_f_path}")
        t1_f = self.test_user_1.get_personal_folder()
        for p in paths:
            d = DocEntry.find_by_path(self.get_personal_item_path(p))
            self.assertTrue(self.test_user_1.has_ownership(d))
            self.assertFalse(self.test_user_2.has_view_access(d))
            self.assertTrue(self.test_user_3.has_view_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(t1_f))

        self.get(f"/permissions/removeRecursive/testuser2;testuser3/view/{t1_f_path}")
        t1_f = self.test_user_1.get_personal_folder()
        for p in paths:
            d = DocEntry.find_by_path(self.get_personal_item_path(p))
            self.assertTrue(self.test_user_1.has_ownership(d))
            self.assertFalse(self.test_user_2.has_view_access(d))
            self.assertFalse(self.test_user_3.has_view_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(d))
            self.assertFalse(self.test_user_2.has_edit_access(t1_f))

        self.get(f"/permissions/addRecursive/testuser1/view/{self.test_user_2.get_personal_folder().path}",
                 expect_status=403)
        self.get(f"/permissions/addRecursive/testuser1/asd/{self.test_user_1.get_personal_folder().path}",
                 expect_status=400)
        self.get(f"/permissions/addRecursive/nonexistent/view/{self.test_user_1.get_personal_folder().path}",
                 expect_status=404)

        # If the user doesn't have access to all documents, the operation should not complete.
        d = DocEntry.find_by_path(self.get_personal_item_path(paths[-1]))
        for a in d.block.accesses:
            db.session.delete(a)
        db.session.commit()
        self.get(f"/permissions/addRecursive/testuser2;testuser3/view/{t1_f_path}", expect_status=403)
        self.get(f"/permissions/removeRecursive/testuser2;testuser3/view/{t1_f_path}", expect_status=403)
