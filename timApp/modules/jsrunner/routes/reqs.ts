import express from "express";
console.log("reqs");
const router = express.Router();

const backTicks = "```";

const templates = [`
${backTicks} {#runner plugin="jsrunner"}
groups:
 -
fields:
 -
program: |!!

!!
${backTicks} `, `
${backTicks}{#runner1 plugin="jsrunner"}
groups:
 -
fields:
 -
gradingScale:
  1: 10
  2: 20
  3: 30
  4: 40
  5: 50
failGrade: hyl
defaultPoints: 5
program: |!!

!!
${backTicks} `, `
${backTicks} {#fields plugin="jsrunner"}
fieldhelper: true
docid: true
open: true
${backTicks}`]

;

/* GET users listing. */
router.get("/", (req, res, next) => {
    res.json({
        js: ["javascripts/build/jsrunner.js"],
        multihtml: true,
        css: ["stylesheets/jsrunner.css"],
        editor_tabs: [
            {
                text: "Fields",
                items: [
                    {
                        text: "JSRunner",
                        items: [
                            {
                                data: templates[0].trim(),
                                text: "JavaScript runner",
                                expl: "Add basic JavaScript runner task",
                            },
                            {
                                data: templates[1].trim(),
                                text: "Extended JavaScript runner",
                                expl: "Add extended JavaScript runner task",
                            },
                            {
                                data: templates[2].trim(),
                                text: "Show fields",
                                expl: "Show fields in this document",
                            },
                        ],
                    },
                ],
            },
        ],
    });
});

export default router;
