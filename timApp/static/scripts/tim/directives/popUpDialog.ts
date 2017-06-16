import {timApp} from "tim/app";
/**
 * FILL WITH SUITABLE TEXT
 * @module popUpDialog
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

timApp.directive("popUpDialog", function() {
    const toDragOrNot = function() {
        const width = (window.innerWidth > 0) ? window.innerWidth : screen.width;
        if (width > 500) {
            return 'tim-draggable-fixed caption="{{caption}}"';
        }
    };
    return {
        restrict: "E",
        scope: {
            show: "=",
            caption: "=",
            elemId: "=",
        },
        template: "<div class='pop-up' ng-show='show' id='popUpBack'>" +
        "<div class='pop-up-overlay'></div> " +
        "<div id='{{elemId}}' class='pop-up-dialog' " + toDragOrNot() + " ng-mousedown='checkDown($event)' " +
        "ng-mouseup='checkUp($event)' style='top:0; left: 0'>" +
        "<div class='pop-up-dialog-content' ng-transclude></div>" +
        "</div>" +
        "</div>",

        replace: true,
        transclude: true,

        link($scope, $element) {
            /**
             * FILL WITH SUITABLE TEXT
             * @memberof module:popUpDialog
             * @param e
             */
            $scope.checkDown = function(e) {
                $scope.mouseDownX = e.clientX;
                $scope.mouseDownY = e.clientY;
                const window = $element.find("popUpBack");
                const ctx = window.context as HTMLElement;
                ctx.style.position = "absolute";
                ctx.style.bottom = "auto";

            };

            /**
             * FILL WITH SUITABLE TEXT
             * @memberof module:popUpDialog
             */
            $scope.checkUp = function() {
                const window = $element.find("popUpBack");
                const ctx = window.context as HTMLElement;
                ctx.style.position = "fixed";
            };
        },

    };
});
