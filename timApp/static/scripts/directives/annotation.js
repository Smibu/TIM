/**
 * Created by localadmin on 4.4.2016.
 *
 * Annotations uses attribute as a directive declaration, because IE does not support
 * custom elements reliably.
 */

'use strict';

/* Directive for marking */
timApp.directive("annotation", function() {
    return{
        templateUrl: "/static/templates/annotation.html",
        transclude: true,
        scope: {
            // locked, selected ?
            show: '=',
            velp: '@',
            points: '=',
            //evalAsync: '@',
            user: '@',
            comments: '=',
            aid: '='
        },
        controller: 'AnnotationController'
    }
});

timApp.controller('AnnotationController', ['$scope', '$http', function ($scope, $http){
    $scope.newComment = "";

    /**
     * Toggle annotation visibility
     */
    $scope.toggleAnnotation = function() {
        $scope.show = !$scope.show;
    };

    /**
     * Delete selected annotation. Queries parent scope.
     */
    $scope.deleteAnnotation = function(){
        if ($scope.comments.length < 2) {
            $scope.$parent.deleteAnnotation($scope.aid);
            $scope.toggleAnnotation();
        }
    };

    /**
     * Changes points of selected annotation. Queries parent scope.
     */
    $scope.changePoints = function(){
        $scope.$parent.changeAnnotationPoints($scope.aid, $scope.points);
    };

    /**
     * Add comment to annotation
     */
    $scope.addComment = function() {
        if ($scope.newComment.length > 0) {
            $scope.comments.push({author: $scope.user, content: $scope.newComment});
            var id = $scope.$parent.getRealAnnotationId($scope.aid);
            var data = {annotation_id: id, content: $scope.newComment};

            $scope.$parent.makePostRequest("/addannotationcomment", data, function(json){console.log(json);});

        }
        $scope.newComment = "";
    };
    /*
    $scope.toggleAnnotation();
    $scope.toggleAnnotation();
    */

}]);