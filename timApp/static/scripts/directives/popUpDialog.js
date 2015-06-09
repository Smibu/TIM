/**
 * @module popUpDialog
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

timApp.directive('popUpDialog', function () {
    return {
        restrict: 'E',
        template: "<div class='pop-up' ng-show='show' id='popUpBack'>"+
        "<div class='pop-up-overlay'></div> " +
        "<div class='pop-up-dialog' tim-draggable-fixed ng-mousedown='checkDown($event)' ng-mouseup='checkUp($event)'>" +
        "<div class='pop-up-dialog-content' ng-transclude></div>" +
        "</div>" +
        "</div>",

        scope: {
            show: '='
        },
        replace: true,
        transclude: true,

        link: function ($scope, $element) {

            /**
             * @memberof module:popUpDialog
             * @param e
             */
            $scope.checkDown = function (e) {
                $scope.mouseDownX = e.clientX;
                $scope.mouseDownY = e.clientY;
                var window = $element.find("popUpBack");
                window.context.style.position = "absolute";
                window.context.style.bottom = 'auto';

            };

            /**
             * @memberof module:popUpDialog
             */
            $scope.checkUp = function () {
                var window = $element.find("popUpBack");
                window.context.style.position = "fixed";
            };
        }

    };
});