var katex, $, angular, MathJax;

var timApp = angular.module('timApp').config(['$httpProvider', function ($httpProvider) {
    timLogTime("timApp config","view");
    var interceptor = [
        '$q',
        '$rootScope',
        '$window',
        function ($q, $rootScope, $window) {
            var re = /\/[^/]+\/([^/]+)\/answer\/$/;
            var service = {
                'request': function (config) {
                    if (re.test(config.url)) {
                        var match = re.exec(config.url);
                        var taskIdFull = match[1];
                        var parts = taskIdFull.split('.');
                        var docId = parseInt(parts[0], 10);
                        var taskName = parts[1];
                        var parId = parts[2];
                        var taskId = docId + '.' + taskName;
                        if (taskName !== '') {
                            var ab = angular.element("answerbrowser[task-id='" + taskId + "']");
                            if (ab.isolateScope()) {
                                var browserScope = ab.isolateScope();
                                angular.extend(config.data, {abData: browserScope.getBrowserData()});
                            }
                        }
                        angular.extend(config.data, {ref_from: {docId: docId, par: parId}});
                    }
                    return config;
                },
                'response': function (response) {
                    if (re.test(response.config.url)) {
                        var match = re.exec(response.config.url);
                        var taskIdFull = match[1];
                        var parts = taskIdFull.split('.');
                        var docId = parseInt(parts[0], 10);
                        var taskName = parts[1];
                        var taskId = docId + '.' + taskName;
                        $rootScope.$broadcast('answerSaved', {taskId: taskId, savedNew: response.data.savedNew});
                        if (response.data.error) {
                            $window.alert(response.data.error);
                        }
                    }
                    return response;
                }
            };
            return service;
        }
    ];
    $httpProvider.interceptors.push(interceptor);
}]);

timApp.controller("ViewCtrl", [
    '$scope',
    '$http',
    '$q',
    '$injector',
    '$compile',
    '$window',
    '$document',
    '$rootScope',
    '$localStorage',
    '$filter',
    '$timeout',
    function (sc, http, q, $injector, $compile, $window, $document, $rootScope, $localStorage, $filter, $timeout) {
        "use strict";
        timLogTime("VieCtrl start","view");
        http.defaults.headers.common.Version = $window.version.hash;
        http.defaults.headers.common.RefererPath = $window.refererPath;
        sc.noBrowser = $window.noBrowser;
        sc.docId = $window.docId;
        sc.docName = $window.docName;
        sc.showIndex = $window.showIndex;
        sc.crumbs = $window.crumbs;
        sc.rights = $window.rights;
        sc.startIndex = $window.startIndex;
        sc.users = $window.users;
        sc.group = $window.group;
        sc.teacherMode = $window.teacherMode;
        sc.sidebarState = 'autohidden';
        sc.lectureMode = $window.lectureMode;
        if (sc.users.length > 0) {
            sc.selectedUser = sc.users[0];
        } else {
            sc.selectedUser = null;
        }

        sc.noteClassAttributes = ["difficult", "unclear", "editable", "private"];
        sc.editing = false;

        sc.questionShown = false;
        sc.firstTimeQuestions = true;
        sc.mathJaxLoaded = false;
        sc.mathJaxLoadDefer = null;
        sc.hideRefresh = false;
        sc.hidePending = false;
        sc.hideMessage = false;
        sc.pendingUpdates = {};
        var EDITOR_CLASS = "editorArea";
        var EDITOR_CLASS_DOT = "." + EDITOR_CLASS;

        // from https://stackoverflow.com/a/7317311
        $window.onload = function () {
            $window.addEventListener("beforeunload", function (e) {
                if (!sc.editing) {
                    return undefined;
                }

                var msg = 'You are currently editing something. Are you sure you want to leave the page?';

                (e || $window.event).returnValue = msg; //Gecko + IE
                return msg; //Gecko + Webkit, Safari, Chrome etc.
            });
        };

        sc.reload = function() {
            sc.markPageNotDirty();
            $window.location.reload();
        };

        sc.closeRefreshDlg = function() {
            sc.hideRefresh = true;
        };

        sc.closeMessageDlg = function() {
            sc.hideMessage = true;
        };

        sc.markPageDirty = function() {
            var e = angular.element('#page_is_dirty');
            e.val('1');
            sc.hideRefresh = true;
        };

        sc.markPageNotDirty = function() {
            var e = angular.element('#page_is_dirty');
            e.val('0');
        };

        sc.isPageDirty = function() {
            var e = angular.element('#page_is_dirty');
            return e.val() === '1';
        };

        sc.processAllMathDelayed = function ($elem) {
            $timeout(function () {
                sc.processAllMath($elem);
            }, 500);
        };

        sc.processAllMath = function ($elem) {
            timLogTime("processAllMath start","view");
            $elem.find('.math').each(function () {
                sc.processMath(this);
            });
            timLogTime("processAllMath end","view");
        };

        sc.processMath = function (elem) {
            try {
                $window.renderMathInElement(elem);
            }
            catch (e) {
                if (sc.mathJaxLoaded) {
                    MathJax.Hub.Queue(["Typeset", MathJax.Hub, elem]);
                } else {
                    if (sc.mathJaxLoadDefer === null) {
                        sc.mathJaxLoadDefer = $.ajax({
                            dataType: "script",
                            cache: true,
                            url: "//cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML"
                        });
                    }
                    sc.mathJaxLoadDefer.done(function () {
                        sc.mathJaxLoaded = true;
                        MathJax.Hub.Queue(["Typeset", MathJax.Hub, elem]);
                    });
                }
            }
        };

        sc.showDialog = function (message) {
            $('<div id="dialog"><p>' + message + '</div>').dialog({
                dialogClass: "no-close", modal: true,
                close: function (event, ui) {
                    $(this).dialog("close");
                    $(this).remove();
                },
                buttons: [
                    {
                        text: "OK",
                        click: function () {
                            $(this).dialog("close");
                        }
                    }
                ]
            });
        };

        sc.$on('showDialog', function (event, message) {
            sc.showDialog(message);
        });

        sc.changeUser = function (user) {
            sc.selectedUser = user;
            sc.$broadcast('userChanged', {user: user});
        };

        sc.getParId = function ($par) {
            if ($par.length === 0 || !$par.hasClass('par')) {
                return null;
            }
            return $par.attr("id");
        };

        sc.getAreaDocId = function ($area) {
            if (!$area.hasClass('area')) {
                return null;
            }

            return $area.attr("data-doc-id");
        };

        sc.getAreaId = function ($area) {
            if (!$area.hasClass('area')) {
                return null;
            }

            return $area.attr("data-name");
        };

        sc.getFirstPar = function ($par_or_area) {
            if ($par_or_area.hasClass('area')) {
                return $par_or_area.find('.par').first();
            }

            return $par_or_area;
        };

        sc.getLastPar = function ($par_or_area) {
            if ($par_or_area.hasClass('area')) {
                return $par_or_area.find('.par').last();
            }

            return $par_or_area;
        };

        sc.getFirstParId = function ($par_or_area) {
            return sc.getParId(sc.getFirstPar($par_or_area));
        };

        sc.getLastParId = function ($par_or_area) {
            return sc.getParId(sc.getLastPar($par_or_area));
        };

        sc.getElementByParId = function (id) {
            return $("#" + id);
        };

        sc.getElementByParHash = function(t) {
            return $("[t='" + t + "']");
        };

        sc.getAreaStart = function() {
            return sc.selection.reversed ? sc.selection.end : sc.selection.start;
        };

        sc.getAreaEnd = function() {
            return sc.selection.reversed ? sc.selection.start : sc.selection.end;
        };

        sc.toggleParEditor = function ($par_or_area, options) {
            var $par = sc.getFirstPar($par_or_area);
            var area_start, area_end;
            var caption = 'Add paragraph';
            var touch = typeof('ontouchstart' in window || navigator.msMaxTouchPoints) !== 'undefined';
            var mobile = touch && (window.screen.width < 1200);
            var url;

            if ($par_or_area.hasClass('area')) {
                area_start = sc.getParId($par);
                area_end = sc.getLastParId($par_or_area);
                url = '/postParagraph/';

            } else {
                // TODO: Use same route (postParagraph) for both cases, determine logic based on given parameters
                if (par_id == "null" || $par_or_area.hasClass("new")) {
                    url = '/newParagraph/';
                } else {
                    url = '/postParagraph/';
                }

                area_start = options.area ? sc.getAreaStart() : null;
                area_end = options.area ? sc.getAreaEnd() : null;
            }

            var par_id = sc.getParId($par);
            var par_next_id = sc.getParId($par.next());
            if (par_next_id == "null")
                par_next_id = null;


            var attrs = {
                "save-url": url,
                "extra-data": {
                    docId: sc.docId, // current document id
                    par: par_id, // the id of paragraph on which the editor was opened
                    par_next: par_next_id, // the id of the paragraph that follows par or null if par is the last one
                    area_start: area_start,
                    area_end: area_end
                },
                "options": {
                    showDelete: options.showDelete,
                    showImageUpload: true,
                    showPlugins: true,
                    destroyAfterSave: true,
                    touchDevice: mobile,
                    tags: [
                        {name: 'markread', desc: 'Mark as read'}
                    ]
                },
                "after-save": 'addSavedParToDom(saveData, extraData)',
                "after-cancel": 'handleCancel(extraData)',
                "after-delete": 'handleDelete(saveData, extraData)',
                "preview-url": '/preview/' + sc.docId,
                "delete-url": '/deleteParagraph/' + sc.docId
            };
            if (options.showDelete) {
                caption = 'Edit paragraph';
                if (par_id != "null")
                    attrs["initial-text-url"] = '/getBlock/' + sc.docId + "/" + par_id;
            }
            sc.toggleEditor($par_or_area, options, attrs, caption);
        };

        sc.getRefAttrs = function ($par) {
            return {
                'ref-id': $par.attr('ref-id'),
                'ref-t': $par.attr('ref-t'),
                'ref-doc-id': $par.attr('ref-doc-id')
            };
        };

        sc.toggleEditor = function ($par, options, attrs, caption) {
            if (sc.isReference($par)) {
                angular.extend(attrs['extra-data'], sc.getRefAttrs($par));
            }
            Object.keys(attrs).forEach(function (key, index) {
                if (typeof attrs[key] === 'object' && attrs[key] !== null) {
                    //console.log('converting ' + key + " to string");
                    attrs[key] = JSON.stringify(attrs[key]);
                }
            });
            if ($par.children(EDITOR_CLASS_DOT).length) {
                $par.children().remove(EDITOR_CLASS_DOT);
                sc.editing = false;
            } else {
                $(EDITOR_CLASS_DOT).remove();

                var createEditor = function (attrs) {
                    var $div = $("<pareditor>", {class: EDITOR_CLASS}).attr(attrs);
                    $div.attr('tim-draggable-fixed', '');
                    if (caption) {
                        $div.attr('caption', caption);
                    }
                    $par.append($div);
                    $compile($div[0])(sc);
                    sc.editing = true;
                };

                if (options.showDelete) {
                    $(".par.new").remove();
                }
                createEditor(attrs);

            }
        };

        sc.showQuestion = function (questionId) {
            sc.json = "No data";
            sc.qId = questionId;

            http({
                url: '/getQuestionById',
                method: 'GET',
                params: {'question_id': sc.qId, 'buster': new Date().getTime()}
            })
                .success(function (data) {
                    sc.json = JSON.parse(data.questionJson);
                    $rootScope.$broadcast('changeQuestionTitle', {'title': sc.json.TITLE});
                    $rootScope.$broadcast("setPreviewJson", {
                        questionJson: sc.json,
                        questionId: sc.qId,
                        points: data.points,
                        expl: JSON.parse(data.expl),
                        isLecturer: sc.isLecturer
                    });
                })

                .error(function () {
                    $window.console.log("There was some error creating question to database.");
                });


            sc.lectureId = -1;
            sc.inLecture = false;

            sc.$on('postLectureId', function (event, response) {
                sc.lectureId = response;
            });

            sc.$on('postInLecture', function (event, response) {
                sc.inLecture = response;
            });

            $rootScope.$broadcast('getLectureId');
            $rootScope.$broadcast('getInLecture');
            sc.showQuestionPreview = true;
        };

        sc.showQuestionNew = function (parId, parIdNext) {
            sc.json = "No data";
            sc.questionParId = parId;
            sc.questionParIdNext = parIdNext;

            http({
                url: '/getQuestionByParId',
                method: 'GET',
                params: {'par_id': sc.questionParId, 'doc_id': sc.docId, 'buster': new Date().getTime()}
            })
                .success(function (data) {
                    sc.json = data.questionJson;
                    $rootScope.$broadcast('changeQuestionTitle', {'title': sc.json.TITLE});
                    $rootScope.$broadcast("setPreviewJson", {
                        questionJson: sc.json,
                        questionParId: sc.questionParId,
                        questionParIdNext: sc.questionParIdNext,
                        points: data.points,
                        expl: data.expl,
                        isLecturer: sc.isLecturer
                    });
                })

                .error(function () {
                    $window.console.log("Could not question.");
                });


            sc.lectureId = -1;
            sc.inLecture = false;

            sc.$on('postLectureId', function (event, response) {
                sc.lectureId = response;
            });

            sc.$on('postInLecture', function (event, response) {
                sc.inLecture = response;
            });

            $rootScope.$broadcast('getLectureId');
            $rootScope.$broadcast('getInLecture');
            sc.showQuestionPreview = true;
        };

        sc.toggleNoteEditor = function ($par_or_area, options) {
            var caption = 'Edit comment';
            var touch = typeof('ontouchstart' in window || navigator.msMaxTouchPoints) !== 'undefined';
            var mobile = touch && (window.screen.width < 1200);
            if (!sc.rights.can_comment) {
                return;
            }
            var url,
                data, initUrl;
            if (options.isNew) {
                caption = 'Add comment';
                url = '/postNote';
                data = {
                    access: sc.$storage.noteAccess,
                    tags: {
                        difficult: false,
                        unclear: false
                    }
                };
                initUrl = null;
            } else {
                url = '/editNote';
                data = {};
                initUrl = '/note/' + options.noteData.id;
            }
            var $par = sc.getFirstPar($par_or_area);
            var par_id = sc.getFirstParId($par_or_area),
                attrs = {
                    "save-url": url,
                    "extra-data": angular.extend({
                        docId: sc.docId,
                        par: par_id,
                        isComment: true
                    }, data),
                    "options": {
                        showDelete: !options.isNew,
                        showImageUpload: true,
                        showPlugins: false,
                        touchDevice: mobile,
                        tags: [
                            {name: 'difficult', desc: 'The text is difficult to understand'},
                            {name: 'unclear', desc: 'The text is unclear'}
                        ],
                        choices: {
                            desc: [{
                                desc: 'Show note to:',
                                name: 'access',
                                opts: [
                                    {desc: 'Everyone', value: 'everyone'},
                                    {desc: 'Just me', value: 'justme'}
                                ]
                            }]
                        },
                        destroyAfterSave: true
                    },
                    "after-save": 'handleNoteSave(saveData, extraData)',
                    "after-cancel": 'handleNoteCancel(extraData)',
                    "after-delete": 'handleNoteDelete(saveData, extraData)',
                    "preview-url": '/preview/' + sc.docId,
                    "delete-url": '/deleteNote',
                    "initial-text-url": initUrl
                };
            sc.toggleEditor($par, options, attrs, caption);
        };

        sc.forEachParagraph = function (func) {
            $('.paragraphs .par').each(func);
        };

        // Event handlers

        sc.fixPageCoords = function (e) {
            if (!('pageX' in e) || (e.pageX === 0 && e.pageY === 0)) {
                e.pageX = e.originalEvent.touches[0].pageX;
                e.pageY = e.originalEvent.touches[0].pageY;
            }
            return e;
        };
        
        sc.oldWidth = $($window).width();
        $($window).resize(function (e) {
            if (e.target === $window) {
                var newWidth = $($window).width();
                if (newWidth !== sc.oldWidth) {
                    sc.oldWidth = newWidth;
                    var selected = $('.par.lightselect, .par.selected');
                    if (selected.length > 0) {
                        selected[0].scrollIntoView();
                    }
                }
            }
        });

        sc.onClick = function (className, func, overrideModalCheck) {
            var downEvent = null;
            var downCoords = null;

            $document.on('mousedown touchstart', className, function (e) {
                if (!overrideModalCheck && $(".actionButtons").length > 0 || $(EDITOR_CLASS_DOT).length > 0) {
                    // Disable while there are modal gui elements
                    return;
                }
                downEvent = sc.fixPageCoords(e);
                downCoords = {left: downEvent.pageX, top: downEvent.pageY};
            });
            $document.on('mousemove touchmove', className, function (e) {
                if (downEvent === null) {
                    return;
                }

                var e2 = sc.fixPageCoords(e);
                if (sc.dist(downCoords, {left: e2.pageX, top: e2.pageY}) > 10) {
                    // Moved too far away, cancel the event
                    downEvent = null;
                }
            });
            $document.on('touchcancel', className, function (e) {
                downEvent = null;
            });
            $document.on('mouseup touchend', className, function (e) {
                if (downEvent !== null) {
                    if (func($(this), downEvent)) {
                        e.preventDefault();
                    }
                    downEvent = null;
                }
            });
        };

        sc.onMouseOver = function (className, func) {
            $document.on('mouseover', className, function (e) {
                if (func($(this), sc.fixPageCoords(e))) {
                    e.preventDefault();
                }
            });
        };

        sc.onMouseOut = function (className, func) {
            $document.on('mouseout', className, function (e) {
                if (func($(this), sc.fixPageCoords(e))) {
                    e.preventDefault();
                }
            });
        };

        sc.showEditWindow = function (e, $par) {
            $(".par.new").remove();
            sc.toggleParEditor($par, {showDelete: true, area: false});
        };

        sc.editSettingsPars = function () {
            var pars = [];
            $(".par").each(function () {
                if ($(this).attr("attrs").indexOf("settings") >= 0)
                {
                    pars.push(this);
                }
            });
            if (pars.length == 0)
            {
                var par_next = sc.getParId($(".par:first"));
                if (par_next == "null")
                {
                    par_next = null;
                }
                http.post('/newParagraph/', {
                    "text" : '``` {settings=""}\nexample:\n```',
                    "docId" : sc.docId,
                    "par_next" : par_next
                }).success(function(data, status, headers, config) {
                    $window.location.reload();
                }).error(function(data, status, headers, config) {
                    $window.alert(data.error);
                });
            }
            else if (pars.length == 1)
            {
                sc.toggleParEditor($(pars[0]), {showDelete: true, area: false});
            }
            else
            {
                var start = pars[0];
                var end = pars[pars.length - 1];
                sc.selection.start = sc.getParId($(start));
                sc.selection.end = sc.getParId($(end));
                sc.selection.reversed = false;
                $(pars).addClass('selected');
                sc.toggleParEditor($(pars), {showDelete: true, area: true});
                $(pars).removeClass('selected');
                sc.cancelArea();
            }
        };

        sc.beginAreaEditing = function (e, $par) {
            $(".par.new").remove();
            sc.toggleParEditor($par, {showDelete: true, area: true});
        };

        sc.createNewPar = function () {
            return $("<div>", {class: "par new", id: 'NEW_PAR', attrs: '{}'})
                .append($("<div>", {class: "parContent"}).html('New paragraph'));
        };

        sc.showPopupMenu = function (e, $par_or_area, coords, attrs) {
            var $popup = $('<popup-menu>');
            $popup.attr('tim-draggable-fixed', '');
            $popup.attr('srcid', $par_or_area.attr('id'));
            for (var key in attrs) {
                if (attrs.hasOwnProperty(key)) {
                    $popup.attr(key, attrs[key]);
                }
            }
            $par_or_area.prepend($popup); // need to prepend to DOM before compiling
            $compile($popup[0])(sc);
            // TODO: Set offset for the popup
            var element = $popup;
            var viewport = {};
            viewport.top = $(window).scrollTop();
            viewport.bottom = viewport.top + $(window).height();
            var bounds = {};
            bounds.top = element.offset().top;
            bounds.bottom = bounds.top + element.outerHeight();
            var y = $(window).scrollTop();
            if (bounds.bottom > viewport.bottom) {
                y += (bounds.bottom - viewport.bottom);
            }
            else if (bounds.top < viewport.top) {
                y += (bounds.top - viewport.top);
            }
            $('html, body').animate({
                scrollTop: y
            }, 500);
        };

        sc.showAddParagraphMenu = function (e, $par_or_area, coords) {
            sc.showPopupMenu(e, $par_or_area, coords, {actions: 'addParagraphFunctions'});
        };
        
        sc.showAddParagraphAbove = function (e, $par) {
            var $newpar = sc.createNewPar();
            $par.before($newpar);
            sc.toggleParEditor($newpar, {showDelete: false, area: false});
        };

        sc.showAddParagraphBelow = function (e, $par) {
            var $newpar = sc.createNewPar();
            $par.after($newpar);
            sc.toggleParEditor($newpar, {showDelete: false, area: false});
        };

        sc.showPasteMenu = function (e, $par_or_area, coords) {
            sc.pasteFunctions = sc.getPasteFunctions();
            sc.showPopupMenu(e, $par_or_area, coords, {actions: 'pasteFunctions', contenturl: '/clipboard'});
        };

        sc.showMoveMenu = function (e, $par_or_area, coords) {
            sc.pasteFunctions = sc.getMoveFunctions();
            sc.showPopupMenu(e, $par_or_area, coords, {actions: 'pasteFunctions', contenturl: '/clipboard'});
        };

        sc.pasteContentAbove = function (e, $par) {
            sc.pasteAbove(e, $par, false);
        };

        sc.pasteRefAbove = function (e, $par) {
            sc.pasteAbove(e, $par, true);
        };
        
        sc.pasteContentBelow = function (e, $par) {
            sc.pasteBelow(e, $par, false);
        };

        sc.pasteRefBelow = function (e, $par) {
            sc.pasteBelow(e, $par, true);
        };

        sc.deleteFromSource = function () {
            http.post('/clipboard/deletesrc/' + sc.docId, {
            }).success(function(data, status, headers, config) {
                var doc_ver = data['doc_ver'];
                var pars = data['pars'];
                if (pars.length > 0) {
                    var first_par = pars[0].id;
                    var last_par = pars[pars.length - 1].id;
                    sc.handleDelete({version: doc_ver}, {par: first_par, area_start: first_par, area_end: last_par});
                }

                sc.allowPasteContent = false;
                sc.allowPasteRef = false;
            }).error(function(data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.moveAbove = function (e, $par_or_area) {
            http.post('/clipboard/paste/' + sc.docId, {
                "par_before" : sc.getFirstParId($par_or_area),
            }).success(function(data, status, headers, config) {
                if (data == null)
                    return;

                var $newpar = sc.createNewPar();
                $par_or_area.before($newpar);

                var extra_data = {
                    docId: sc.docId, // current document id
                    par: sc.getFirstParId($newpar), // the id of paragraph on which the editor was opened
                    par_next: $par_or_area.id // the id of the paragraph that follows par
                };

                sc.addSavedParToDom(data, extra_data);
                sc.deleteFromSource();

            }).error(function(data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.moveBelow = function (e, $par_or_area) {
            http.post('/clipboard/paste/' + sc.docId, {
                "par_after" : sc.getLastParId($par_or_area),
            }).success(function(data, status, headers, config) {
                if (data == null)
                    return;

                var $newpar = sc.createNewPar();
                $par_or_area.after($newpar);

                var extra_data = {
                    docId: sc.docId, // current document id
                    par: sc.getFirstParId($newpar), // the id of paragraph on which the editor was opened
                    par_next: $par_or_area.id // the id of the paragraph that follows par
                };

                sc.addSavedParToDom(data, extra_data);
                sc.deleteFromSource();

            }).error(function(data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.pasteAbove = function (e, $par_or_area, as_ref) {
            http.post('/clipboard/paste/' + sc.docId, {
                "par_before" : sc.getFirstParId($par_or_area),
                "as_ref": as_ref
            }).success(function(data, status, headers, config) {
                if (data == null)
                    return;

                var $newpar = sc.createNewPar();
                $par_or_area.before($newpar);

                var extra_data = {
                    docId: sc.docId, // current document id
                    par: sc.getFirstParId($newpar), // the id of paragraph on which the editor was opened
                    par_next: $par_or_area.id // the id of the paragraph that follows par
                };

                sc.addSavedParToDom(data, extra_data);

            }).error(function(data, status, headers, config) {
                $window.alert(data.error);
            });
        };
        
        sc.pasteBelow = function (e, $par_or_area, as_ref) {
            http.post('/clipboard/paste/' + sc.docId, {
                "par_after" : sc.getLastParId($par_or_area),
                "as_ref": as_ref
            }).success(function(data, status, headers, config) {
                if (data == null)
                    return;

                var $newpar = sc.createNewPar();
                $par_or_area.after($newpar);

                var extra_data = {
                    docId: sc.docId, // current document id
                    par: sc.getFirstParId($newpar), // the id of paragraph on which the editor was opened
                    par_next: $par_or_area.id // the id of the paragraph that follows par
                };

                sc.addSavedParToDom(data, extra_data);

            }).error(function(data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        // Event handler for "Add question below"
        // Opens pop-up window to create question.
        sc.addQuestion = function (e, $par) {
            var parId = sc.getParId($par);
            var parNextId = sc.getParId($par.next());
            var $newpar = sc.createNewPar();
            $par.after($newpar);
            $rootScope.$broadcast('toggleQuestion');
            $rootScope.$broadcast('newQuestion', {'par_id': parId,'par_id_next': parNextId});
            sc.par = $par;
        };

        $.fn.slideFadeToggle = function (easing, callback) {
            return this.animate({opacity: 'toggle', height: 'toggle'}, 'fast', easing, callback);
        };

        sc.handleCancel = function (extraData) {
            var $par = sc.getElementByParId(extraData.par);
            if ($par.hasClass("new")) {
                $par.remove();
            }
            sc.editing = false;
        };

        sc.handleDelete = function (data, extraData) {
            var $par = sc.getElementByParId(extraData.par);
            http.defaults.headers.common.Version = data.version;
            if (extraData.area_start !== null && extraData.area_end !== null) {
                $par = sc.getElementByParId(extraData.area_start);
                var $endpar = sc.getElementByParId(extraData.area_end);
                if (extraData.area_start !== extraData.area_end) {
                    $par.nextUntil($endpar).add($endpar).remove();
                }
            }
            $par.remove();
            sc.editing = false;
            sc.cancelArea();
            sc.beginUpdate();
        };

        sc.beginUpdate = function () {
            http.get('/getUpdatedPars/' + sc.docId)
                .success(function (data, status, headers, config) {
                    sc.updatePendingPars(data.changed_pars);
                })
                .error(function () {
                    $window.alert('Error occurred when getting updated paragraphs.')
                });
        };

        sc.getElementByRefId = function (ref) {
            return $(".par[ref-id='" + ref +  "']");
        };

        sc.removeDefaultPars = function () {
            sc.getElementByParId("null").remove();
        };

        sc.addSavedParToDom = function (data, extraData) {
            var $par;
            if (angular.isDefined(extraData['ref-id'])) {
                $par = sc.getElementByRefId(extraData['ref-id']);
            } else {
                $par = sc.getElementByParId(extraData.par);
            }

            // check if we were editing an area
            if (angular.isDefined(extraData.area_start) &&
                angular.isDefined(extraData.area_start) &&
                extraData.area_start !== null &&
                extraData.area_end !== null) {
                $par = sc.getElementByParId(extraData.area_start);

                // remove all but the first element of the area because it'll be used
                // when replacing
                var $endpar = sc.getElementByParId(extraData.area_end);
                $par.nextUntil($endpar).add($endpar).remove();
            }
            var newPars = $($compile(data.texts)(sc));

            if ($window.editMode === 'area')
                newPars.find('.editline').removeClass('editline').addClass('editline-disabled');

            $par.replaceWith(newPars);
            sc.processAllMathDelayed(newPars);
            http.defaults.headers.common.Version = data.version;
            sc.editing = false;
            sc.cancelArea();
            sc.removeDefaultPars();
            sc.markPageDirty();
            sc.beginUpdate();
        };

        sc.pendingUpdatesCount = function () {
            return Object.keys(sc.pendingUpdates).length;
        };

        sc.showUpdateDialog = function () {
            return !sc.hidePending && sc.pendingUpdatesCount() > 0;
        };

        sc.updatePendingPars = function (pars) {
            angular.extend(sc.pendingUpdates, pars);
            sc.hidePending = false;
            if (sc.pendingUpdatesCount() < 10) {
                sc.updatePending();
            }
        };

        sc.updatePending = function () {
            for (var key in sc.pendingUpdates) {
                if (sc.pendingUpdates.hasOwnProperty(key)) {
                    var $par = sc.getElementByParId(key);
                    var newPar = $($compile(sc.pendingUpdates[key])(sc));
                    $par.replaceWith(newPar);
                    sc.processAllMathDelayed(newPar);
                }
            }
            sc.pendingUpdates = {};
            if (sc.lectureMode) { sc.getAndEditQuestions(); }
        };

        sc.isReference = function ($par) {
            return angular.isDefined($par.attr('ref-id'));
        };

        sc.markParRead = function ($this, $par) {
            var oldClass = $this.attr("class");
            $this.attr("class", "readline read");
            var par_id = sc.getParId($par);
            var data = {};
            if (sc.isReference($par)) {
                data = sc.getRefAttrs($par);
            }
            if ( !sc.selectedUser ) return true;
            if ( sc.selectedUser.name.indexOf("Anonymous") == 0 ) return true;
            http.put('/read/' + sc.docId + '/' + par_id + '?_=' + Date.now(), data)
                .success(function (data, status, headers, config) {
                    sc.markPageDirty();
                }).error(function () {
                    $window.alert('Could not save the read marking.');
                    $this.attr("class", oldClass);
                });
            return true;
        };

        sc.onClick(".readline, .readlineQuestion" , function ($this, e) {
            return sc.markParRead($this, $this.parents('.par'));
        });

        sc.isParWithinArea = function ($par) {
            return sc.selection.pars.filter($par).length > 0;
        };

        sc.onClick(".editline, .editlineQuestion", function ($this, e) {
            sc.closeOptionsWindow();
            var $par = $this.parent().filter('.par');
            if (sc.selection.start !== null && (sc.selection.end === null || !sc.isParWithinArea($par))) {
                sc.selection.end = sc.getParId($par);
            }
            var coords = {left: e.pageX - $par.offset().left, top: e.pageY - $par.offset().top};
            return sc.showOptionsWindow(e, $par, coords);
        });

        sc.onClick(".areaeditline", function ($this, e) {
            sc.closeOptionsWindow();
            var $area = $this.parent().filter('.area');
            //var $pars = $area.find('.par');
            //var $first_par = $pars.first();
            //var $last_par = $pars.last();
            var coords = {left: e.pageX - $area.offset().left, top: e.pageY - $area.offset().top};
            //sc.selection.start = sc.getParId($first_par);
            //sc.selection.end = sc.getParId($last_par);
            return sc.showOptionsWindow(e, $area, coords);
        });

        sc.setAreaAttr = function(area, attr, value) {
            var area_selector = "[data-area=" + area + "]";
            $(area_selector).css(attr, value);
        };

        sc.onClick(".areacollapse", function ($this, e) {
            $this.removeClass("areacollapse");
            var area_name = $this.parent().attr('data-area-start');
            console.log("Collapse " + area_name);
            sc.setAreaAttr(area_name, "display", "none");
            $this.addClass("disabledexpand");

            // Set expandable after a timeout to avoid expanding right after collapse
            $window.setTimeout(function() { $this.removeClass("disabledexpand"); $this.addClass("areaexpand"); }, 200);
        });

        sc.onClick(".areaexpand", function ($this, e) {
            $this.removeClass("areaexpand");
            var area_name = $this.parent().attr('data-area-start');
            console.log("Expand " + area_name);
            sc.setAreaAttr(area_name, "display", "");
            $this.addClass("disabledcollapse");

            // Set collapsible after a timeout to avoid collapsing right after expand
            $window.setTimeout(function() { $this.removeClass("disabledcollapse"); $this.addClass("areacollapse"); }, 200);
        });

        sc.showNoteWindow = function (e, $par) {
            sc.toggleNoteEditor($par, {isNew: true});
        };

        sc.handleNoteCancel = function () {
            sc.editing = false;
        };

        sc.handleNoteDelete = function (saveData, extraData) {
            sc.addSavedParToDom(saveData, extraData);
        };

        sc.handleNoteSave = function (saveData, extraData) {
            sc.addSavedParToDom(saveData, extraData);
        };

        sc.onClick('.paragraphs .parContent', function ($this, e) {
            if (sc.editing) {
                return false;
            }

            var $target = $(e.target);
            var tag = $target.prop("tagName");

            // Don't show paragraph menu on these specific tags or class
            var ignoredTags = ['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'QUESTIONADDEDNEW'];
            if (ignoredTags.indexOf(tag) > -1 || $target.parents('.no-popup-menu').length > 0) {
                return false;
            }

            var $par = $this.parent();
            if (sc.selection.start !== null) {
                sc.selection.end = sc.getParId($par);
            }
            else {
                var coords = {left: e.pageX - $par.offset().left, top: e.pageY - $par.offset().top};
                var toggle1 = $par.find(".actionButtons").length === 0;
                var toggle2 = $par.hasClass("lightselect");

                $(".par.selected").removeClass("selected");
                $(".par.lightselect").removeClass("lightselect");
                sc.closeOptionsWindow();
                sc.toggleActionButtons(e, $par, toggle1, toggle2, coords);
            }
            sc.$apply();
            return true;
        }, true);

        sc.onClick(".note", function ($this, e) {
            if (!$this.hasClass('editable')) {
                sc.showDialog('You cannot edit this note.');
                return true;
            }
            sc.toggleNoteEditor($this.parents('.par'), {isNew: false, noteData: {id: $this.attr('note-id')}});
            return true;
        });

        sc.onClick(".questionAdded", function ($this, e) {
            var question = $this;
            var questionId = question[0].getAttribute('id');
            sc.showQuestion(questionId);
            sc.par = ($(question).parent().parent());
        });

        sc.onClick(".questionAddedNew", function ($this, e) {
            var question = $this;
            var $par = $(question).parent().parent();
            var parId = $($par)[0].getAttribute('id');
            var parNextId = sc.getParId($par.next());
            sc.showQuestionNew(parId, parNextId);
            sc.par = ($(question).parent());
        });

        sc.onClick("html.ng-scope", function ($this, e) {
            // Clicking anywhere
            var tagName = e.target.tagName.toLowerCase();
            var ignoreTags = ['button', 'input'];
            if (sc.editing || $.inArray(tagName, ignoreTags) >= 0 || $(e.target).hasClass("menu-icon")) {
                return false;
            }

            sc.closeOptionsWindow();

            if (tagName !== "p") {
                $(".selected").removeClass("selected");
                $(".lightselect").removeClass("lightselect");
            }

            //console.log(e.target);
            return true;

        }, true);

        sc.showOptionsWindow = function (e, $par_or_area, coords) {
            $par_or_area.children('.editline').addClass('menuopen');
            sc.showPopupMenu(e, $par_or_area, coords,
                {actions: 'editorFunctions', save: 'defaultAction', onclose: 'optionsWindowClosed'});
        };

        sc.closeOptionsWindow = function () {
            var $actionButtons = $(".actionButtons");
            var $par_or_area = $actionButtons.parent();
            $actionButtons.remove();
            sc.optionsWindowClosed($par_or_area);
        };

        sc.optionsWindowClosed = function ($par_or_area) {
            var $editline = $par_or_area.find('.editline');
            $editline.removeClass('menuopen');
        };

        sc.dist = function (coords1, coords2) {
            return Math.sqrt(Math.pow(coords2.left - coords1.left, 2) + Math.pow(coords2.top - coords1.top, 2));
        };

        sc.getEditorFunc = function(description) {
            if (description === "Show options window")
                return sc.showOptionsWindow;

            for (var i = 0; i < sc.editorFunctions.length; i++) {
                if (sc.editorFunctions[i].desc === description)
                    return sc.editorFunctions[i].func;
            }
        };

        sc.toggleActionButtons = function (e, $par, toggle1, toggle2, coords) {
            if ($window.editMode == 'area')
                return;

            if (!sc.rights.editable && !sc.rights.can_comment) {
                return;
            }
            if (toggle2) {
                // Clicked twice successively
                var clicktime = new Date().getTime() - sc.lastclicktime;
                var clickdelta = sc.dist(coords, sc.lastclickplace);
                $par.addClass("selected");

                if (clickdelta > 10) {
                    // Selecting text
                    $par.removeClass("selected");
                    $par.removeClass("lightselect");
                }
                else if (clicktime < 500 && sc.$storage.defaultAction !== null) {
                    // Double click
                    var func = sc.getEditorFunc(sc.$storage.defaultAction);
                    func(e, $par, coords);
                }
                else {
                    // Two clicks
                    sc.showOptionsWindow(e, $par, coords);
                }
            } else if (toggle1) {
                // Clicked once
                $par.addClass("lightselect");
                sc.lastclicktime = new Date().getTime();
                sc.lastclickplace = coords;
            } else {
                $window.console.log("This line is new: " + $par);
                $par.children().remove(".actionButtons");
                $par.removeClass("selected");
                $par.removeClass("lightselect");
            }
        };

        sc.getQuestionHtml = function (questions) {
            var questionImage = '/static/images/show-question-icon.png';
            var $questionsDiv = $("<div>", {class: 'questions'});

            // TODO: Think better way to get the ID of question.
            for (var i = 0; i < questions.length; i++) {
                var img = new Image(30, 30);
                img.src = questionImage;
                img.title = questions[i].question_title;
                var $questionDiv = $("<span>", {
                    class: 'questionAdded', html: img, id: questions[i].question_id
                });
                $questionsDiv.append($questionDiv);
            }
            return $questionsDiv;
        };

        sc.getAndEditQuestions = function () {
            var questions = $('.editlineQuestion');
            for (var i = 0; i < questions.length; i++) {
                var questionParent = $(questions[i].parentNode);
                var questionChildren = $(questionParent.children());
                var questionNumber = $(questionChildren.find($('.questionNumber')));
                var questionTitle = JSON.parse(questionParent.attr('attrs')).question;
                if (questionTitle == 'Untitled') {
                    questionTitle = "";
                }
                if(questionTitle.length > 10) {
                    questionTitle = questionTitle.substr(0, 10) + "\r\n...";
                }
                if (questionNumber.length > 0) {
                    questionNumber[0].innerHTML = (i+1)+ ")\r\n" + questionTitle;
                }
                else {
                    var parContent = $(questionChildren[0]);
                    questionParent.addClass('questionPar');
                    parContent.addClass('questionParContent');
                    var p = $("<p>", {class: "questionNumber", text: (i+1) + ")\r\n" + questionTitle});
                    parContent.append(p);
                    var editLine = $(questionChildren[1]);
                    parContent.before(editLine);
                }
            }
        };

        sc.getQuestions = function () {
            var rn = "?_=" + Date.now();

            http.get('/questions/' + sc.docId + rn)
                .success(function (data) {
                    var pars = {};
                    var questionCount = data.length;
                    for (var i = 0; i < questionCount; i++) {
                        var pi = data[i].par_id;
                        if (!(pi in pars)) {
                            pars[pi] = {questions: []};
                        }

                        pars[pi].questions.push(data[i]);
                    }

                    Object.keys(pars).forEach(function (par_id, index) {
                        var $par = sc.getElementByParId(par_id);
                        $par.find(".questions").remove();
                        var $questionsDiv = sc.getQuestionHtml(pars[par_id].questions);
                        $par.append($questionsDiv);
                    });
                });
        };

        sc.getEditPars = function () {
            sc.forEachParagraph(function (index, elem) {
                var $div = $("<div>", {class: "editline", title: "Click to edit this paragraph"});
                $(this).append($div);
            });
        };

        sc.markAllAsRead = function () {
            http.put('/read/' + sc.docId + '?_=' + Date.now())
                .success(function (data, status, headers, config) {
                    $('.readline').attr("class", "readline read");
                }).error(function (data, status, headers, config) {
                    $window.alert('Could not mark the document as read.');
                });
        };

        sc.setHeaderLinks = function () {
            $(".parContent").each(function () {
                var $p = $(this);
                $p.find('h1, h2, h3, h4, h5, h6').each(function () {
                    var $h = $(this);
                    var id = $h.attr('id');
                    if (angular.isDefined(id)) {
                        $h.append($("<a>", {
                            text: '#',
                            href: '#' + id,
                            class: 'headerlink',
                            title: 'Permanent link'
                        }));
                    }
                });
            });
        };

        // Index-related functions

        sc.totext = function (str) {
            if (str.indexOf('{') > 0) {
                return str.substring(0, str.indexOf('{')).trim();
            }
            return str;
        };

        sc.tolink = function (str) {
            if (str.indexOf('{') >= 0 && str.indexOf('}') > 0) {
                var ob = str.indexOf('{');
                var cb = str.indexOf('}');
                return str.substring(ob + 1, cb);
            }
            return "#" + str.replace(/^(\d)+(\.\d+)*\.? /, "").trim().replace(/ +/g, '-').toLowerCase();
        };

        sc.findIndexLevel = function (str) {
            for (var i = 0; i < str.length; i++) {
                if (str.charAt(i) !== '#') {
                    return i;
                }
            }

            return 0;
        };

        sc.getIndex = function () {
            timLogTime("getindex","view");
            http.get('/index/' + sc.docId)
                .success(function (data) {
                    timLogTime("getindex succ","view");
                    if (data.empty) {
                        sc.showIndex = false;
                    } else {
                        var indexElement = $(".index-sidebar .sideBarContainer");
                        $(indexElement).html(data);
                        sc.showIndex = true;
                    }
                    timLogTime("getindex done","view");
                }).error(function () {
                    console.log("Could not get index");
                });
        };

        sc.invertState = function (state) {
            if (state === 'exp') {
                return 'col';
            }
            if (state === 'col') {
                return 'exp';
            }
            return state;
        };

        sc.clearSelection = function () {
            if ($document.selection) {
                $document.selection.empty();
            }
            else if ($window.getSelection) {
                $window.getSelection().removeAllRanges();
            }
        };

        sc.invertStateClearSelection = function (event, state) {
            if (event.which !== 1) {
                // Listen only to the left mouse button
                return state;
            }

            var newState = sc.invertState(state);
            if (newState !== state) {
                sc.clearSelection();
            }
            return newState;
        };


        sc.onClick('.showContent', function ($this, e) {
            sc.contentShown = !sc.contentShown;
            var $pars = $('#pars');
            if (sc.contentLoaded) {
                if (sc.contentShown) {
                    $pars.css('display', '');
                    $('.showContent').text('Hide content');
                } else {
                    $pars.css('display', 'none');
                    $('.showContent').text('Show content');
                }
                return true;
            }
            var $loading = $('<div>', {class: 'par', id: 'loading'});
            $loading.append($('<img>', {src: "/static/images/loading.gif"}));
            $('.paragraphs').append($loading);
            http.get('/view_content/' + sc.docName)
                .success(function (data) {
                    var $loading = $('#loading');
                    $loading.remove();
                    $('.paragraphs').append($compile(data)(sc));
                    sc.getIndex();
                    sc.processAllMath($('body'));
                    /*
                     if (sc.rights.editable) {
                     sc.getEditPars();
                     }*/
                    if (sc.lectureMode) {
                        sc.getQuestions();
                    }
                    $('.showContent').text('Hide content');
                }).error(function (data) {
                    var $loading = $('#loading');
                    $loading.remove();
                    $window.console.log("Error occurred when fetching view_content");
                });
            sc.contentLoaded = true;
            return true;
        });

        sc.$on("getQuestions", function () {
            if (sc.firstTimeQuestions) {
                sc.getQuestions();
                sc.firstTimeQuestions = false;
            }
        });

        sc.$on("closeQuestionPreview", function () {
            sc.showQuestionPreview = false;
        });

        // Load index, notes and read markings
        timLogTime("getList start","view");
        sc.setHeaderLinks();
        timLogTime("getList end","view");


        // If you add 'mousedown' to bind, scrolling upon opening the menu doesn't work on Android
        $('body,html').bind('scroll wheel DOMMouseScroll mousewheel', function (e) {
            if (e.which > 0 || e.type === "mousedown" || e.type === "mousewheel") {
                $("html,body").stop();
            }
        });

        if (sc.rights.editable) {
            sc.onClick(".addBottom", function ($this, e) {
                $(".actionButtons").remove();
                //var $par = $('.par').last();
                //return sc.showAddParagraphBelow(e, $par);
                return sc.showAddParagraphAbove(e, $(".addBottomContainer"));
            });

            sc.onClick(".pasteBottom", function ($this, e) {
                $(".actionButtons").remove();
                sc.pasteAbove(e, $(".addBottomContainer"), false);
            });

            sc.onClick(".pasteRefBottom", function ($this, e) {
                $(".actionButtons").remove();
                sc.pasteAbove(e, $(".addBottomContainer"), true);
            });
        }
        sc.processAllMathDelayed($('body'));

        sc.getEditMode = function() { return $window.editMode; };

        sc.defaultAction = {func: sc.showOptionsWindow, desc: 'Show options window'};
        timLogTime("VieCtrl end","view");
        sc.selection = {start: null, end: null};
        sc.$watchGroup(['lectureMode', 'selection.start', 'selection.end', 'editing', 'getEditMode()',
                        'allowPasteContent', 'allowPasteRef'], function (newValues, oldValues, scope) {
            sc.editorFunctions = sc.getEditorFunctions();
            if (sc.editing) {
                sc.notification = "Editor is already open.";
            } else {
                sc.notification = "";
            }
        });

        sc.$watchGroup(['selection.start', 'selection.end'], function (newValues, oldValues, scope) {
            $('.par.selected').removeClass('selected');
            if (sc.selection.start !== null) {
                var $start = sc.getElementByParId(sc.selection.start);
                if (sc.selection.end !== null && sc.selection.end !== sc.selection.start) {
                    var $end = sc.getElementByParId(sc.selection.end);
                    if ($end.prevAll().filter($start).length !== 0) {
                        sc.selection.reversed = false;
                        sc.selection.pars = $start.nextUntil($end);

                    } else {
                        sc.selection.reversed = true;
                        sc.selection.pars = $start.prevUntil($end);
                    }
                    sc.selection.pars = sc.selection.pars.add($start).add($end);
                } else {
                    sc.selection.pars = $start;
                }
                sc.selection.pars.addClass('selected');
            }
        });

        sc.onMouseOver('.parlink', function ($this, e) {
            sc.over_reflink = true;

            var $par = $this.parents('.par').find('.parContent');
            var coords = {left: e.pageX - $par.offset().left + 10, top: e.pageY - $par.offset().top + 10};
            var params;

            try {
                params = {
                    docid: $this[0].attributes['data-docid'].value,
                    parid: $this[0].attributes['data-parid'].value
                };
            } catch (TypeError) {
                // The element was modified
                return;
            }

            sc.showRefPopup(e, $this, coords, params);
        });

        sc.onMouseOver('.ref-popup', function ($this, e) {
            sc.over_popup = true;
        });

        sc.onMouseOut('.ref-popup', function ($this, e) {
            sc.over_popup = false;
            sc.hideRefPopup();
        });

        sc.onMouseOut('.parlink', function ($this, e) {
            sc.over_reflink = false;
            sc.hideRefPopup();
        });

        sc.showRefPopup = function (e, $ref, coords, attrs) {
            var $popup = $('<ref-popup>');
            $popup.offset(coords);

            for (var attr in attrs) {
                if (attrs.hasOwnProperty(attr)) {
                    $popup.attr(attr, attrs[attr]);
                }
            }

            $ref.parent().prepend($popup); // need to prepend to DOM before compiling
            $compile($popup[0])(sc);
            return $popup;
        };

        sc.hideRefPopup = function() {
            if (sc.over_reflink || sc.over_popup)
                return;

            $(".refPopup").remove();
        };

        sc.cutPar = function (e, $par) {
            var par_id = sc.getParId($par);

            http.post('/clipboard/cut/' + sc.docId + '/' + par_id + '/' + par_id, {
                }).success(function(data, status, headers, config) {
                    var doc_ver = data['doc_ver'];
                    var pars = data['pars'];
                    if (pars.length > 0) {
                        var first_par = pars[0].id;
                        var last_par = pars[pars.length - 1].id;
                        sc.handleDelete({version: doc_ver}, {par: first_par, area_start: first_par, area_end: last_par});
                    }

                    sc.allowPasteContent = true;
                    sc.allowPasteRef = false;
                }).error(function(data, status, headers, config) {
                    $window.alert(data.error);
                });
        };

        sc.copyPar = function (e, $par) {
            var par_id = sc.getParId($par);

            http.post('/clipboard/copy/' + sc.docId + '/' + par_id + '/' + par_id, {
                }).success(function(data, status, headers, config) {
                    sc.allowPasteContent = true;
                    sc.allowPasteRef = true;
                }).error(function(data, status, headers, config) {
                    $window.alert(data.error);
                });
        };

        sc.startArea = function (e, $par) {
            sc.selection.start = sc.getFirstParId($par);
        };

        sc.cancelArea = function (e, $par) {
            sc.selection.start = null;
            sc.selection.end = null;
        };

        sc.cutArea = function (e, $par_or_area, cut) {
            sc.copyArea(e, $par_or_area, sc.docId, true);
        };

        sc.copyArea = function (e, $par_or_area, override_doc_id, cut) {
            var ref_doc_id, area_name, area_start, area_end;

            if ($window.editMode == 'area') {
                ref_doc_id = sc.getAreaDocId($par_or_area);
                area_name = sc.getAreaId($par_or_area);
                area_start = sc.getFirstParId($par_or_area);
                area_end = sc.getLastParId($par_or_area);
            } else {
                ref_doc_id = null;
                area_name = null;
                area_start = sc.getAreaStart();
                area_end = sc.getAreaEnd();
            }

            var doc_id = override_doc_id ? override_doc_id : sc.docId;

            if (cut) {
                http.post('/clipboard/cut/' + doc_id + '/' + area_start + '/' + area_end, {
                    area_name: area_name
                }).success(function (data, status, headers, config) {
                    if (doc_id == sc.docId) {
                        var doc_ver = data['doc_ver'];
                        var pars = data['pars'];
                        if (pars.length > 0) {
                            var first_par = pars[0].id;
                            var last_par = pars[pars.length - 1].id;
                            sc.handleDelete({version: doc_ver}, {
                                par: first_par,
                                area_start: first_par,
                                area_end: last_par
                            });

                            sc.allowPasteContent = true;
                            sc.allowPasteRef = false;
                        }
                    }
                }).error(function (data, status, headers, config) {
                    $window.alert(data.error);
                });

            } else {
                http.post('/clipboard/copy/' + doc_id + '/' + area_start + '/' + area_end, {
                    ref_doc_id: ref_doc_id,
                    area_name: area_name
                }).success(function (data, status, headers, config) {
                    sc.allowPasteContent = true;
                    sc.allowPasteRef = true;
                }).error(function (data, status, headers, config) {
                    $window.alert(data.error);
                });
            }
        };

        sc.nothing = function () {
        };

        sc.goToEditor = function (e, $par) {
            $('pareditor')[0].scrollIntoView();
        };

        sc.closeAndSave = function (e, $par) {
            $('pareditor').isolateScope().saveClicked();
            sc.showOptionsWindow(e, $par);
        };

        sc.closeWithoutSaving = function (e, $par) {
            $('pareditor').isolateScope().cancelClicked();
            sc.showOptionsWindow(e, $par);
        };

        sc.getEditorFunctions = function () {
            if (sc.editing) {
                return [
                    {func: sc.goToEditor, desc: 'Go to editor', show: true},
                    {func: sc.closeAndSave, desc: 'Close editor and save', show: true},
                    {func: sc.closeWithoutSaving, desc: 'Close editor and cancel', show: true},
                    {func: sc.nothing, desc: 'Close menu', show: true}
                ];
            } else if (sc.selection.start !== null && $window.editMode) {
                return [
                    {
                        func: sc.beginAreaEditing,
                        desc: 'Edit area',
                        show: true
                    },
                    {func: sc.cutArea, desc: 'Cut area', show: true},
                    {func: sc.copyArea, desc: 'Mark area', show: true},
                    {func: sc.cancelArea, desc: 'Cancel area', show: true},
                    {func: sc.nothing, desc: 'Close menu', show: true}
                ];
            } else {
                return [
                    {func: sc.showNoteWindow, desc: 'Comment/note', show: sc.rights.can_comment},
                    {func: sc.cutPar, desc: 'Cut paragraph', show: $window.editMode === 'par'},
                    {func: sc.copyPar, desc: 'Mark paragraph', show: $window.editMode === 'par'},
                    {func: sc.showEditWindow, desc: 'Edit', show: sc.rights.editable},
                    {func: sc.showAddParagraphAbove, desc: 'Add paragraph above', show: sc.rights.editable},
                    {func: sc.cutArea, desc: 'Cut area', show: $window.editMode === 'area'},
                    {func: sc.copyArea, desc: 'Mark area', show: $window.editMode === 'area'},
                    {func: sc.showPasteMenu, desc: 'Paste...', show: $window.editMode && !sc.allowPasteRef && sc.allowPasteContent},
                    {func: sc.showPasteMenu, desc: 'Copy/paste here...', show: $window.editMode && sc.allowPasteRef},
                    {func: sc.showMoveMenu, desc: 'Move here...', show: $window.editMode && sc.allowPasteContent && sc.allowPasteRef},
                    {func: sc.addQuestion, desc: 'Create question', show: sc.lectureMode && sc.rights.editable},
                    {
                        func: sc.startArea,
                        desc: 'Start selecting area',
                        show: $window.editMode == 'par' && sc.selection.start === null
                    },
                    {func: sc.nothing, desc: 'Close menu', show: true}
                ];
            }
        };

        sc.getAddParagraphFunctions = function () {
            return [
                {func: sc.showAddParagraphAbove, desc: 'Above', show: true},
                {func: sc.showAddParagraphBelow, desc: 'Below', show: true},
                {func: sc.nothing, desc: 'Cancel', show: true}
            ];
        };

        sc.getPasteFunctions = function () {
            return [
                {func: sc.pasteRefAbove, desc: 'Above, as a reference', show: sc.allowPasteRef},
                {func: sc.pasteContentAbove, desc: 'Above, as content', show: sc.allowPasteContent},
                {func: sc.pasteRefBelow, desc: 'Below, as a reference', show: sc.allowPasteRef},
                {func: sc.pasteContentBelow, desc: 'Below, as content', show: sc.allowPasteContent},
                {func: sc.nothing, desc: 'Cancel', show: true}
            ];
        };

        sc.getMoveFunctions = function () {
            return [
                {func: sc.moveAbove, desc: 'Above', show: sc.allowPasteContent},
                {func: sc.moveBelow, desc: 'Below', show: sc.allowPasteContent},
                {func: sc.nothing, desc: 'Cancel', show: true}
            ];
        };

        // call marktree.js initialization function so that TOC clicking works
        $window.addEvents();

        sc.editorFunctions = sc.getEditorFunctions();
        sc.addParagraphFunctions = sc.getAddParagraphFunctions();
        sc.pasteFunctions = sc.getPasteFunctions();

        sc.getAndEditQuestions();

        sc.allowPasteContent = true;
        sc.allowPasteRef = true;

        sc.$storage = $localStorage.$default({
            defaultAction: "Show options window",
            noteAccess: 'everyone'
        });

        try {
            var found = $filter('filter')(sc.editorFunctions,
                {desc: sc.$storage.defaultAction}, true);
            if (found.length) {
                sc.defaultAction = found[0];
            }
        } catch (e) {
        }
    }
])
;