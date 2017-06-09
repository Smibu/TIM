
import $ from "jquery";
import {timApp} from "tim/app";
/**
 * A popup window directive that is used in the document view
 * when creating a new area.
 */
timApp.directive("nameArea", ["$http", "$window", "$filter", function($http, $window, $filter) {
    return {
        restrict: "E",
        scope: true, // we need functions from parent scope
        templateUrl: "/static/templates/nameArea.html",
        replace: true,

        link($scope, $element, $attrs) {
            $scope.$area = $element.parents(".area").first();
            if ($attrs.onclose)
                $scope.onClose = eval("$scope." + $attrs.onclose);
            if ($attrs.onok)
                $scope.onOk = eval("$scope." + $attrs.onok);
            if ($attrs.oncancel)
                $scope.onCancel = eval("$scope." + $attrs.oncancel);

            $("#areaname").keypress(function(e) {
                if (e.which == 13)
                    $scope.addArea();
            });
        },

        controller: ["$scope", "$element", function($scope, $element) {
            $scope.closePopup = function() {
                $scope.$destroy();
                $element.remove();

                if ($scope.onClose)
                    $scope.onClose($scope.$area);
            };

            $scope.addArea = function() {
                $scope.closePopup();

                if ($scope.onOk)
                    $scope.onOk($scope.$area, $scope.areaName, $scope.options);
            };

            $scope.cancelAdd = function() {
                $scope.closePopup();

                if ($scope.onCancel)
                    $scope.onCancel($scope.$area);
            };

            $scope.areaName = "";
            $scope.options = {collapse: true, hlevel: 0};
            $element.css("position", "absolute"); // IE needs this
            $scope.datePickerOptions = {
                format: "D.M.YYYY HH:mm:ss",
                showTodayButton: true,
            };

            $("#areaname").focus();
        }],
    };
}]);
