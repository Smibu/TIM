import json

from selenium.webdriver import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.select import Select

from timApp.answer.answers import save_answer
from timApp.plugin.taskid import TaskId
from timApp.tests.browser.browsertest import BrowserTest
from timApp.tests.browser.browsertest import find_button_by_text
from timApp.timdb.sqa import db
from timApp.velp.annotation import Annotation
from timApp.velp.annotation_model import AnnotationPosition, AnnotationCoordinate
from timApp.velp.velp import create_new_velp
from timApp.velp.velp_models import (
    VelpGroup,
)


class VelpTest(BrowserTest):
    def test_velps(self):
        """Ensures:

        * Velp selection component is visible in /velp route
        * New velp can be created
        * The created velp appears in the list of velps
        """
        self.login_browser_quick_test1()
        self.login_test1()
        d = self.create_doc(initial_par="This is a velp test.")
        self.goto_document(d, view="velp")

        velp_selection_element = self.drv.find_element(
            by=By.CSS_SELECTOR, value="#velpSelection"
        )

        create_velp_btn = find_button_by_text(velp_selection_element, "Create new velp")
        self.wait.until(expected_conditions.element_to_be_clickable(create_velp_btn))

        self.assert_same_screenshot(
            velp_selection_element, ["velps/velp_selection_empty"]
        )

        create_velp_btn.click()
        new_velp_selector = ".velp-data.new.edit"
        new_velp_element: WebElement = velp_selection_element.find_element(
            by=By.CSS_SELECTOR, value=new_velp_selector
        )
        self.assert_same_screenshot(new_velp_element, "velps/create_new_velp_empty")

        velp_content_input: WebElement = new_velp_element.find_element(
            by=By.CSS_SELECTOR, value='input[ng-model="$ctrl.velp.content"]'
        )
        velp_content_input.send_keys("first velp")

        velp_points_input: WebElement = new_velp_element.find_element(
            by=By.CSS_SELECTOR, value='input[ng-model="$ctrl.velp.points"]'
        )
        velp_points_input.send_keys("2")

        velp_comment_input: WebElement = new_velp_element.find_element(
            by=By.CSS_SELECTOR, value='textarea[ng-model="$ctrl.velp.default_comment"]'
        )
        velp_comment_input.send_keys("Just a default comment.")

        # Setting the color does not work well because SystemJS does not find the module for some reason.
        # velp_color_input: WebElement = new_velp_element.find_element(by=By.CSS_SELECTOR, value='input[ng-model="velp.color"]')
        # self.drv.execute_script(
        #     f"""
        #     arguments[0].value = '#00FF00';
        #     SystemJS.registry.get("http://tim/static/scripts/tim/ngimport.ts").$rootScope.$apply();
        #     """,
        #     velp_color_input)

        velp_visible_input = Select(
            new_velp_element.find_element(
                by=By.CSS_SELECTOR, value='select[ng-model="$ctrl.velp.visible_to"]'
            )
        )
        velp_visible_input.select_by_visible_text("Just me")
        self.assert_same_screenshot(new_velp_element, "velps/create_new_velp_filled")

        save_button: WebElement = new_velp_element.find_element(
            by=By.CSS_SELECTOR, value='input[type="submit"]'
        )
        save_button.click()
        self.wait_until_hidden(new_velp_selector)

        # get mouse out of the newly created velp so that the velp is not highlighted
        ActionChains(self.drv).move_to_element(create_velp_btn).perform()

        self.assert_same_screenshot(
            velp_selection_element,
            [
                "velps/velp_selection_one_velp",
            ],
        )

        # Selecting text using these styles does not work for some reason:
        # par: WebElement = self.drv.find_element(by=By.CSS_SELECTOR, value='.parContent > p')
        # ActionChains(self.drv).key_down(Keys.LEFT_SHIFT).send_keys(Keys.ARROW_RIGHT,
        #                                                            Keys.ARROW_RIGHT).key_up(
        #     Keys.LEFT_SHIFT).perform()
        # ActionChains(self.drv).move_to_element_with_offset(par, 5, 5).click_and_hold().move_by_offset(70, 0).release().perform()

    def test_velp_user_filtering(self):
        self.login_browser_quick_test1()
        self.login_test1()
        d = self.create_doc(
            initial_par="""
``` {plugin="csPlugin" #empty1}
type: drawio
task: true
saveButton: Tallenna
```
                """
        )
        ans = save_answer(
            [self.test_user_1],
            TaskId.parse(f"{d.id}.empty1"),
            content={
                "c": '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="121px" height="61px" viewBox="-0.5 -0.5 121 61" content="<mxfile host=&quot;embed.diagrams.net&quot; modified=&quot;2022-03-25T22:40:24.012Z&quot; agent=&quot;5.0 (Windows)&quot; version=&quot;17.2.4&quot; etag=&quot;kENQxLtLtahoiedhYcwl&quot; type=&quot;embed&quot;><diagram id=&quot;-GxsC_QVCotSblny81Id&quot; name=&quot;Page-1&quot;>jZI9b8QgDIZ/DXsCba5dm961S6cMnVFwAxKJI440SX99STH50OmkLsg8tsF+bSbKdnpzstcfqMAynqmJiVfGuch4OBcwR8CLhwgaZ1RE+QYq8wMEM6KDUXA9BHpE601/hDV2HdT+wKRzOB7DvtAef+1lAzegqqW9pZ9GeR3pEz9t/B1Mo9PPefEcPa1MwdTJVUuF4w6JMxOlQ/TRaqcS7KJd0iXmXe5418IcdP4/CTSIb2kH6o3q8nNq1uHQKVjiMyZeRm08VL2sF+8YphuY9q0NtzyY9Bw4D9PdkvK10bAggC14N4cQSjiRNLQbj3QdN6HzpJ7eiVwQkzTbZn14az8YpEC6bkr/+XbrKs6/</diagram></mxfile>"><defs></defs><g><rect x="0" y="0" width="120" height="60" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"></rect></g></svg>'
            },
            points=0,
        )
        db.session.commit()
        self.goto_document(d)
        def_group_res = self.post(f"{d.id}/create_default_velp_group")
        default_group_id = def_group_res["id"]
        vg = VelpGroup.query.get(default_group_id)
        new_velp, _ = create_new_velp(
            self.test_user_1.id,
            "content",
            0,
        )
        vg.velps[new_velp.id] = new_velp
        db.session.commit()
        par = self.find_element_avoid_staleness(".par.csPlugin")
        parid = par.get_attribute("id")
        t = par.get_attribute("t")
        dd = [
            {
                "type": "rectangle",
                "drawData": {
                    "x": 33.20001220703125,
                    "y": 127.16667175292969,
                    "w": 52,
                    "h": 60,
                    "opacity": 1,
                    "color": "red",
                    "lineWidth": 11,
                },
            }
        ]
        # ann 1
        ann = Annotation(
            velp_version_id=1,
            visible_to=4,
            points=1,
            annotator_id=self.test_user_1.id,
            document_id=d.id,
            color=None,
            answer_id=ans.id,
            draw_data=json.dumps(dd),
            style=1,
        )
        db.session.add(ann)
        ann.set_position_info(
            AnnotationPosition(
                AnnotationCoordinate(parid, t=t), AnnotationCoordinate(parid, t=t)
            )
        )
        dd = [
            {
                "drawData": {
                    "color": "red",
                    "h": 40,
                    "lineWidth": 11,
                    "opacity": 1,
                    "w": 38,
                    "x": 523.2000122070312,
                    "y": 24.800003051757812,
                },
                "type": "rectangle",
            }
        ]
        # ann 2
        ann = Annotation(
            velp_version_id=1,
            visible_to=4,
            points=1,
            annotator_id=self.test_user_2.id,
            document_id=d.id,
            color=None,
            answer_id=ans.id,
            draw_data=json.dumps(dd),
            style=1,
        )
        db.session.add(ann)
        ann.set_position_info(
            AnnotationPosition(
                AnnotationCoordinate(parid, t=t), AnnotationCoordinate(parid, t=t)
            )
        )
        db.session.commit()
        self.goto_document(d, "teacher")
        iframe = self.find_element_avoid_staleness("jsframe-runner iframe")
        iframe.click()
        self.find_element_avoid_staleness("answerbrowser")
        velpbox = self.drv.find_element(By.XPATH, "//*[text()[contains(.,'Velps')]]")
        velpbox.click()
        self.wait_until_present(".canvasObjectContainer annotation")
        velper_selector_element = self.find_element(
            "select[ng-model='$ctrl.reviewerUser']"
        )
        self.find_element("draw-toolbar button").click()
        velper_selector_dropdown = Select(velper_selector_element)
        canvas = self.find_element(".drawbase")
        velper_selector_dropdown.select_by_index(1)
        velp_to_use = self.find_element("velp-window:nth-child(2) .velp")
        # ann 3
        ActionChains(self.drv).move_to_element(canvas).move_by_offset(
            0, -150
        ).click_and_hold().move_by_offset(20, 20).release().perform()
        velp_to_use.click()
        # ann 4
        ActionChains(self.drv).move_to_element(canvas).move_by_offset(
            -50, 100
        ).click_and_hold().move_by_offset(20, 20).release().perform()
        velp_to_use.click()
        self.wait_until_hidden("span[ng-if='$ctrl.rctrl.selectedElement']")
        self.find_element("annotation[aid='3'] span.glyphicon-trash").click()
        self.drv.switch_to.alert.accept()
        canvas.click()
        self.wait_until_hidden("span[ng-if='$ctrl.rctrl.selectedElement']")
        # tu1 added velp 1, tu2 added velp2
        # tu1 filters velps by choosing tu2 from the ui
        # tu1 added velps 3 and 4, deleted 3, did not touch filter selector
        # current canvas/annotation container should have velps 2 and 4
        self.assert_same_screenshot(canvas, "velps/filtered_canvas")
