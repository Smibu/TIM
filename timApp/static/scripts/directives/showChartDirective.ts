import angular = require("angular");
import {timApp} from "tim/app";
import {getJsonAnswers} from "tim/directives/dynamicAnswerSheet";
import $ = require("jquery");
import {Chart, ChartData} from "chartjs";

/**
 * Created by hajoviin on 13.5.2015.
 * FILL WITH SUITABLE TEXT
 * @module showChartDirective
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

timApp.directive('showChartDirective', ['$compile', function ($compile) {
    "use strict";
    return {
        restrict: 'E',
        scope: {
            canvas: '@',
            control: '='
        },
        link: function ($scope, $element) {
            $scope.internalControl = $scope.control || {};
            $scope.canvasId = "#" + $scope.canvas || "";
            $scope.isText = false;

            //TODO: If more than 12 choices this will break. Refactor to better format.
            let basicSets = [
                {
                    label: "Answers",
                    backgroundColor: "rgba(0,220,0,0.2)",
                    borderColor: "rgba(0,220,0,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(220,0,0,0.2)",
                    borderColor: "rgba(220,0,0,1)",
                    data: []
                },

                {
                    label: "Answers",
                    backgroundColor: "rgba(0,0,220,0.2)",
                    borderColor: "rgba(0,0,220,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(0,220,220,0.2)",
                    borderColor: "rgba(0,220,220,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(220,0,220,0.2)",
                    borderColor: "rgba(220,0,220,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(220,220,220,0.2)",
                    borderColor: "rgba(220,220,220,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(165,220,0,0.2)",
                    borderColor: "rgba(165,220,0,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(220,165,0,0.2)",
                    borderColor: "rgba(220,165,0,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(0,165,220,0.2)",
                    borderColor: "rgba(220,165,0,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(220,0,165,0.2)",
                    borderColor: "rgba(220,0,165,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(30,0,75,0.2)",
                    borderColor: "rgba(30,0,75,1)",
                    data: []
                },
                {
                    label: "Answers",
                    backgroundColor: "rgba(75,75,180,0.2)",
                    borderColor: "rgba(75,75,180,1)",
                    data: []
                }
            ];

            /**
             * FILL WITH SUITABLE TEXT
             * @memberof module:showChartDirective
             * @param question FILL WITH SUITABLE TEXT
             */
            $scope.internalControl.createChart = function(question) {
                var data = question;
                console.log(question);
                let canvas = $($scope.canvasId)[0] as HTMLCanvasElement;
                $scope.ctx = canvas.getContext("2d");
                $scope.x = 10;
                $scope.y = 20;
                if (typeof question.answerFieldType !== "undefined" && question.answerFieldType === "text") {
                    $scope.isText = true;
                    return;
                }
                $scope.isText = false;
                var labels = [];
                var emptyData = [];
                if (angular.isDefined(data.rows)) {
                    angular.forEach(data.rows, function (row) {
                        var text = row.text;
                        var max = 15;
                        if (text.length > max) text = text.substring(0, max-1) + '...';
                        labels.push(text);
                        emptyData.push(0);
                    });
                }

                if (angular.isDefined(data.columns)) {
                    angular.forEach(data.columns, function (column) {
                        angular.forEach(column.rows, function (row) {
                            labels.push(row.Value);
                            emptyData.push(0);
                        });
                    });
                }

                if (!(question.questionType === "matrix" || question.questionType === "true-false")) {
                    labels.push("No answer");
                    emptyData.push(0);
                }

                var usedDataSets = [];

                if (question.questionType === "true-false" && !question.headers ) {
                    question.headers[0] = {"type": "header", "id": 0, "text": "True"};
                    question.headers[1] = {"type": "header", "id": 1, "text": "False"};
                }

                if (question.questionType === "matrix" || question.questionType === "true-false") {
                    for (var i = 0; i < data.rows[0].columns.length; i++) {
                        usedDataSets.push(basicSets[i]);
                        usedDataSets[i].data = emptyData;
                    }
                    usedDataSets.push(basicSets[usedDataSets.length]);
                    usedDataSets[usedDataSets.length - 1].data = emptyData;
                    usedDataSets[usedDataSets.length - 1].label = "No answer";

                    for (i = 0; i < data.headers.length; i++) {
                        usedDataSets[i].label = data.headers[i].text;
                    }
                } else {
                    usedDataSets.push(basicSets[0]);
                    usedDataSets[0].data = emptyData;
                }

                let bardata: ChartData = {
                    labels,
                    datasets: usedDataSets,
                };
                console.log(usedDataSets);

                $scope.answerChart = new Chart($scope.ctx, {
                    data: bardata,
                    options: {
                        animation: false,
                    },
                    type: "bar",
                });
                $compile($scope);
            };

            /**
             * FILL WITH SUITABLE TEXT
             * @memberof module:showChartDirective
             * @param answers FILL WITH SUITABLE TEXT
             */
            $scope.internalControl.addAnswer = function (answers) {
                if (!angular.isDefined(answers)) {
                    return;
                }
                $scope.ctx.font = "20px Georgia";
                let datasets;
                if (!$scope.isText) {
                    datasets = $scope.answerChart.data.datasets;
                }

                for (var answerersIndex = 0; answerersIndex < answers.length; answerersIndex++) {
                    var answ =  answers[answerersIndex].answer;

                    var onePersonAnswers = getJsonAnswers(answ);
                    for (var a = 0; a < onePersonAnswers.length; a++) {
                        var singleAnswers = onePersonAnswers[a];
                        for (var sa = 0; sa < singleAnswers.length; sa++) {
                            var singleAnswer = singleAnswers[sa];

                            if ($scope.isText) {
                                $scope.ctx.fillText(singleAnswer, $scope.x, $scope.y);
                                $scope.y += 20;
                                continue;
                            }
                            if (datasets.length === 1) {
                                var answered = false;
                                for (var b = 0; b < datasets[0].data.length; b++) {
                                    if ((b + 1) === parseInt(singleAnswer)) {
                                        datasets[0].data[b] += 1;
                                        answered = true;
                                    }
                                }
                                if (!answered) {
                                    datasets[0].data[datasets[0].data.length - 1] += 1;
                                }
                            } else {
                                var answered = false;
                                for (var d = 0; d < datasets.length; d++) {
                                    if ((d + 1) === parseInt(singleAnswer)) {
                                        datasets[d].data[a] += 1;
                                        answered = true;
                                        break;
                                    }
                                }
                                if (!answered) {
                                    datasets[datasets.length - 1].data[a] += 1;
                                }
                            }
                        }
                    }
                }

                if (!$scope.isText) {
                    $scope.answerChart.update();
                }
            };

            /**
             * FILL WITH SUITABLE TEXT
             * @memberof module:showChartDirective
             */
            $scope.internalControl.close = function () {
                let canvas = $($scope.canvasId)[0] as HTMLCanvasElement;
                $scope.ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (typeof $scope.answerChart !== "undefined") {
                    $scope.answerChart.destroy();
                }
                $($scope.canvasId).remove(); // this is my <canvas> element
                $('#chartDiv').append('<canvas id=' + $scope.canvasId.substring(1) + ' width="400" height="300"><canvas>');
                $element.empty();
            };
        }
    };
}])
;
