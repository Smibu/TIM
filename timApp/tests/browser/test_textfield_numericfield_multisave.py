from selenium.webdriver import ActionChains, Keys
from selenium.webdriver.common.by import By

from timApp.tests.browser.browsertest import BrowserTest


class TextfieldPluginTest(BrowserTest):
    def get_screenshot_tolerance(self):
        return 13

    def test_textfield_numericfield_multisave(self):
        self.login_browser_quick_test1()
        self.login_test1()
        d = self.create_doc(
            initial_par="""
#- {plugin=textfield #t1}
cols: 7
autosave: false
#- {plugin=numericfield #t2}
cols: 7
autosave: false
#- {plugin=multisave #t3}
        """,
            settings={"form_mode": True},
        )

        # Test Case 1 - expected success in both fields after Save-button click and page refresh

        self.goto_document(d)
        self.wait_until_present_and_vis("#t1 input")
        field = self.find_element_and_move_to("#t1 input")
        field.send_keys("Aku Ankka")
        self.wait_until_present_and_vis("#t2 input")
        input2 = self.find_element_and_move_to("#t2 input")
        input2.send_keys("2.75")
        self.get_uninteractable_element().click()
        par = self.find_element_avoid_staleness("#pars")
        multisave = self.find_element_avoid_staleness("#t3 tim-multisave")
        self.wait_until_present_and_vis("#t3 div")  # wait for ng-if to finish
        self.assert_same_screenshot(par, ["textfield/fields_before_answer"])
        runbutton = multisave.find_element(by=By.CSS_SELECTOR, value="button")
        runbutton.click()
        self.wait_until_present_and_vis("p.savedtext")
        self.refresh()

        self.wait_until_present_and_vis("#t1 input")
        self.wait_until_present_and_vis("#t2 input")
        par = self.find_element_avoid_staleness("#pars")
        self.assert_same_screenshot(par, ["textfield/fields_after_answer"])

        # Test Case 2 - expected previously saved value in numericField, as it refuses to save empty input

        # TODO: for some reason, the invalid numericfield value (' ') is not validated in browser in selenium,
        #  so an empty value is saved. Disabling the test for now.

        return

        self.goto_document(d)
        self.wait_until_present_and_vis("#t1 input")
        field = self.find_element_and_move_to("#t1 input")
        field.clear()
        field.send_keys(" ")
        self.wait_until_present_and_vis("#t2 input")
        input2 = self.find_element_and_move_to("#t2 input")
        input2.clear()
        input2.send_keys(" ")
        self.get_uninteractable_element.click()
        multisave = self.find_element_avoid_staleness("#t3 tim-multisave")
        runbutton = multisave.find_element(by=By.CSS_SELECTOR, value="button")
        runbutton.click()
        self.goto_document(d)
        self.wait_until_present_and_vis("#t1 input")
        self.wait_until_present_and_vis("#t2 input")
        par = self.find_element_avoid_staleness("#pars")
        self.assert_same_screenshot(par, ["textfield/fields_after_answer_switch"])


class FieldTest(BrowserTest):
    def test_field_failed_save(self):
        # Ensure minimalist textfield shows save button and error messages on save failure
        self.login_browser_quick_test1()
        self.login_test1()
        d = self.create_doc(
            initial_par="""
#- {plugin=textfield #t1}
autosave: true
button: 
                """,
        )
        self.goto_document(d)
        self.wait_until_present_and_vis("#t1 input")
        field = self.find_element_and_move_to("#t1 input")
        field.send_keys("Hello world")
        self.wait_until_hidden("#t1 button")
        self.drv.execute_cdp_cmd("Network.setBlockedURLs", {"urls": ["*"]})
        self.drv.execute_cdp_cmd("Network.enable", {})
        ActionChains(self.drv).send_keys(Keys.ENTER).perform()
        # Tooltip triggers on save
        self.wait_until_present_and_vis("bs-tooltip-container")
        button = self.find_element_avoid_staleness("#t1 button")
        # Hover back and forth to remove tooltip
        self.get_uninteractable_element().click()
        self.find_element_and_move_to("#t1 input")
        self.get_uninteractable_element().click()
        self.wait_until_hidden("bs-tooltip-container")
        button.click()
        # Tooltip triggers again, despite the error being the same as before
        self.wait_until_present_and_vis("bs-tooltip-container")
        self.drv.execute_cdp_cmd("Network.setBlockedURLs", {"urls": []})
        self.drv.execute_cdp_cmd("Network.enable", {})
        button.click()
        self.wait_until_hidden("#t1 .warnFrame")
        self.wait_until_hidden("bs-tooltip-container")
