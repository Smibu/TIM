import angular from "angular";
import $ from "jquery";
import {timApp} from "tim/app";

/**
 * FILL WITH SUITABLE TEXT
 * @module smallMenuCtrl
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

timApp.controller("SmallMenuCtrl", ["$scope", "$window", "$http",
    function($scope, $window, $http) {
		$scope.currentLecturesList = [];
  $scope.futureLecturesList = [];

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:smallMenuCtrl
         */
  const ready = function() {
			$("#currentList").hide();
			$("#futureList").hide();
		};

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:smallMenuCtrl
         */
		$scope.openCurrentLectureMenu = function() {
			$("#currentList").slideToggle();
			$("#futureList").hide();
			$(".menu").hide();

			$http({
                    url: "/getAllLecturesFromDocument",
                    method: "GET",
                    params: {doc_id: $scope.docId},
                })
                    .success(function(lectures) {
                        $scope.currentLecturesList = lectures.currentLectures;

                    })
                    .error(function() {
                    });

		};

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:smallMenuCtrl
         */
		$scope.openFutureLectureMenu = function() {
			$("#futureList").slideToggle();
			$("#currentList").hide();
			$(".menu").hide();

			$http({
                    url: "/getAllLecturesFromDocument",
                    method: "GET",
                    params: {doc_id: $scope.docId},
                })
                    .success(function(lectures) {
                        $scope.futureLecturesList = lectures.futureLectures;
                    })
                    .error(function() {
                    });

		};

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:smallMenuCtrl
         */
		$scope.selectCurrentLecture = function() {

		};

		const w = angular.element($window);
		w.bind("resize", function() {
			$("#currentList").hide();
			$("#futureList").hide();
		});
    },
]);
