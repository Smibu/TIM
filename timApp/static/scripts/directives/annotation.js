/**
 * Handles logic behind single annotation. Annotations uses attribute as a directive declaration, 
 * because IE does not support custom elements reliably.
 * 
 * @module velpSummary
 * @author Joonas Lattu
 * @author Petteri Palojärvi
 * @author Seppo Tarvainen
 * @licence MIT
 * @copyright 2016 Timber project authors
 */

/*
 var angular;
 var timApp = angular.module('timApp');
 */

/* Directive for marking */
timApp.directive("annotation",['$window', function ($window, $timeout) {
    "use strict";
    var console = $window.console;
    return {
        templateUrl: "/static/templates/annotation.html",
        transclude: true,
        scope: {
            show: '=',
            points: '=',
            visibleto: '=',
            comments: '=',
            aid: '=',
            ismargin: '=',
            annotator: '@',
            editaccess: '=',
            //email: '@',
            timesince: '@',
            creationtime: '@',
            velp: '@',
            trigger: '=focusMe'
        },

        link: function (scope, element) {
            scope.newComment = "";
            scope.velpElement = null;

            scope.visible_options = {
                "type": "select",
                "value": scope.visibleto,
                "values": [1, 2, 3, 4],
                "names": ["Just me", "Document owner", "Teachers", "Everyone"]
            };


            // Original visibility, or visibility in session
            // TODO: origin visibility
            scope.original = {
                points: scope.points,
                velp: scope.velp,
                visible_to: scope.visibleto,
                comment: scope.newComment,
                annotation_id: scope.aid
            };

            /**
             * Toggle annotation visibility
             */
            scope.toggleAnnotation = function () {
                scope.show = !scope.show;
                if (scope.show) {
                    scope.updateVelpZIndex();
                }
            };


            /**
             * Update annotation z-index attribute.
             */
            scope.updateVelpZIndex = function () {
                if (scope.velpElement === null) {
                    scope.velpElement = element[0].getElementsByClassName("annotation-info")[0];
                    scope.velpElement.style.zIndex = scope.$parent.zIndex.toString();
                    scope.$parent.zIndex++;
                } else {
                    scope.velpElement.style.zIndex = scope.$parent.zIndex.toString();
                    scope.$parent.zIndex++;
                }
            };

            /**
             * Show annotation, used in summary
             */
            scope.showAnnotation = function () {
                scope.show = true;
                scope.updateVelpZIndex();
            };
            /**
             * Focus comment field.
             */
            scope.focusTextarea =function(){
                alert("focus");
            };

            /**
             * Delete selected annotation. Queries parent scope.
             */
            scope.deleteAnnotation = function () {

                if (scope.comments.length < 2) {
                    console.log(scope.ismargin);
                    if (!$window.confirm("Delete - are you sure?")) {
                        return;
                    }
                    scope.$parent.deleteAnnotation(scope.aid, scope.ismargin);
                    scope.toggleAnnotation();
                }
            };

            /**
             * Changes points of selected annotation. Queries parent scope.
             */
            scope.changePoints = function () {
                console.log(scope.points);
                scope.$parent.changeAnnotationPoints(scope.aid, scope.points);
            };

            /**
             * Save changes to annotation
             */
            scope.saveChanges = function () {
                var id = scope.$parent.getRealAnnotationId(scope.aid);

                // Add comment
                if (scope.newComment.length > 0) {
                    var comment = scope.newComment;

                    var data = {annotation_id: id, content: scope.newComment};
                    scope.$parent.makePostRequest("/add_annotation_comment", data, function (json) {
                        scope.comments.push({
                            commenter_username: json.data.name,
                            content: comment,
                            comment_time: "now",
                            comment_relative_time: "just now"
                        });
                        scope.$parent.addComment(scope.aid, json.data.name, comment);
                    });
                }
                scope.newComment = "";
                if (scope.visible_options.value !== scope.original.visible_to) {
                    scope.$parent.changeVisibility(scope.aid, scope.visible_options.value);
                }
                scope.original = {
                    points: scope.points,
                    annotation_id: id,
                    visible_to: scope.visible_options.value,
                    velp: scope.velp,
                    comment: scope.newComment
                };

                scope.$parent.makePostRequest("/update_annotation", scope.original, function (json) {
                    console.log(json);
                });
            };

            /**
             * Check if user has rights to edit annoatation.
             * @returns {boolean} if user has rights or not.
             */
            scope.checkRights = function () {
                return scope.editaccess !== 1;
            };

            /**
             * Check if annotation is changed comparing to last saved state.
             * @returns {boolean}
             */
            scope.checkIfChanged = function () {
                if (scope.original.points !== scope.points)
                    return true;
                if (scope.original.comment !== scope.newComment)
                    return true;
                if (scope.original.visible_to !== scope.visible_options.value)
                    return true;
                if (scope.original.velp !== scope.velp)
                    return true;
                return false;
            };


            setTimeout(function(){
                if (scope.show) scope.updateVelpZIndex();
            }, 0);
        }
    };
}]);


