from selenium.webdriver import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as ec

from timApp.tests.browser.browsertest import BrowserTest, find_element_by_text, find_button_by_text
from timApp.timdb.sqa import db


def get_change_editor_button(pareditor) -> WebElement:
    change_editor_button = find_button_by_text(pareditor, 'Editor')
    return change_editor_button


def get_cancel_button(pareditor) -> WebElement:
    button = find_button_by_text(pareditor, 'Cancel')
    return button


def find_preview_element(pareditor: WebElement) -> WebElement:
    preview = pareditor.find_element_by_css_selector('.previewcontent')
    return preview


class ParEditorTest(BrowserTest):
    def get_screenshot_tolerance(self) -> float:
        # Using a recent Boot2Docker, sometimes a small vertical yellow line appears next to a button.
        # In that case, the diff value is about 0.002.
        return 0.003

    def wait_for_preview_to_finish(self):
        self.wait.until_not(ec.text_to_be_present_in_element((By.CSS_SELECTOR, '#previewDiv'), '...'))

    def test_add_bottom_focus_switch(self):
        """Ensures:

        * editor is opened from the "Add paragraph" button at the bottom
        * editor gets focus automatically on open
        * preview works
        * switching between plain text area and Ace works
        """
        self.login_browser_quick_test1()
        self.login_test1()
        d = self.create_doc()
        self.goto_document(d)
        self.click_add_bottom()
        self.wait_for_editor_load()
        pareditor = self.get_editor_element()
        ActionChains(self.drv).send_keys('# hello\n\nworld').perform()
        preview = find_preview_element(pareditor)
        self.wait_for_preview_to_finish()
        ActionChains(self.drv).move_to_element(preview).perform()  # avoids having mouse above a toolbar button
        self.assert_same_screenshot(pareditor, 'pareditor/ace_hello_world')
        change_editor_button = get_change_editor_button(pareditor)
        change_editor_button.click()
        self.wait_for_editor_load()
        ActionChains(self.drv).send_keys('!').perform()
        preview.click()  # stop cursor blinking
        self.wait_for_preview_to_finish()
        self.assert_same_screenshot(pareditor, 'pareditor/textarea_hello_world', move_to_element=True)
        change_editor_button.click()
        self.wait_for_editor_load()

        # after deleting the '!', the screenshot should be the same
        ActionChains(self.drv).send_keys(Keys.PAGE_DOWN, Keys.BACKSPACE).perform()
        self.wait_for_preview_to_finish()
        ActionChains(self.drv).move_to_element(preview).perform()
        self.assert_same_screenshot(pareditor, 'pareditor/ace_hello_world')

    def wait_for_editor_load(self):
        self.wait_until_hidden('.editor-loading')

    def get_editor_element(self) -> WebElement:
        pareditor = self.drv.find_element_by_css_selector('pareditor')
        return pareditor

    def click_add_bottom(self):
        add_bottom = self.drv.find_element_by_css_selector('.addBottom')
        add_bottom.click()

    def test_autocomplete(self):
        self.login_browser_quick_test1()
        self.login_test1()
        d = self.create_doc(initial_par='words in the document')
        prefs = self.current_user.get_prefs()
        prefs.use_document_word_list = True
        prefs.word_list = '\n'.join(('cat', 'dog', 'mouse'))
        self.current_user.set_prefs(prefs)
        db.session.commit()
        self.goto_document(d)
        self.click_add_bottom()
        self.wait_for_editor_load()
        pareditor = self.get_editor_element()
        cb = find_element_by_text(pareditor, 'Autocomplete', 'label')
        cb.click()
        editor = self.find_element_and_move_to('.ace_editor')
        editor.click()
        ActionChains(self.drv).send_keys('d').perform()
        self.wait_for_preview_to_finish()
        self.assert_same_screenshot(pareditor, 'pareditor/autocomplete')
        prefs = self.current_user.get_prefs()
        prefs.use_document_word_list = False
        self.current_user.set_prefs(prefs)
        db.session.commit()
        get_cancel_button(pareditor).click()
        alert = self.drv.switch_to.alert
        alert.accept()
        self.goto_document(d)
        self.click_add_bottom()
        self.wait_for_editor_load()
        pareditor = self.get_editor_element()
        ActionChains(self.drv).send_keys('d').perform()
        self.wait_for_preview_to_finish()
        self.assert_same_screenshot(pareditor,
                                    ['pareditor/autocomplete_no_document',
                                     'pareditor/autocomplete_no_document_alt'])
