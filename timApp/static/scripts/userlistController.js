var angular;

var timApp = angular.module('timApp');

timApp.controller('UserListController', ['$scope', '$element', '$filter', '$timeout', 'uiGridConstants',
    function ($scope, $element, $filter, $timeout, uiGridConstants) {
        "use strict";
        $scope.$watch(
            function () {
                return $element[0].offsetHeight + $element[0].offsetWidth;
            },
            function (sum) {
                var grid = $element.find('.grid');
                grid.css('width', ($element[0].offsetWidth - 5) + 'px');
                grid.css('height', ($element[0].offsetHeight - 30) + 'px');
            }
        );

        $scope.columns = [
            {field: 'real_name', name: 'Full name', cellTooltip: true, headerTooltip: true},
            {field: 'name', name: 'Username', cellTooltip: true, headerTooltip: true},
            {field: 'task_count', name: 'Tasks', cellTooltip: true, headerTooltip: true, maxWidth: 70},
            {field: 'total_points', name: 'Points', cellTooltip: true, headerTooltip: true, maxWidth: 70},
            {field: 'velp_points', name: 'Velp points', cellTooltip: true, headerTooltip: true, maxWidth: 70, visible: false},
            {field: 'velped_task_count', name: 'Velped tasks', cellTooltip: true, headerTooltip: true, maxWidth: 70, visible: false}
        ];

        $scope.fireUserChange = function(row, updateAll) {
            $scope.changeUser(row.entity, updateAll);
        };

        $scope.instantUpdate = false;

        $scope.gridOptions = {
            multiSelect: false,
            enableFullRowSelection: true,
            enableRowHeaderSelection: false,
            noUnselect: true,
            enableFiltering: true,
            enableColumnMenus: false,
            enableGridMenu: true,
            data: $scope.users,
            enableSorting: true,
            columnDefs: $scope.columns,
            onRegisterApi: function (gridApi) {
                $scope.gridApi = gridApi;

                gridApi.selection.on.rowSelectionChanged($scope, function (row) {
                    $scope.fireUserChange(row, $scope.instantUpdate);
                });
                gridApi.grid.modifyRows($scope.gridOptions.data);
                gridApi.selection.selectRow($scope.gridOptions.data[0]);
            },
            gridMenuCustomItems: [
                {
                    title: 'Export to Korppi',
                    action: function ($event) {
                        $timeout(function () {
                            var data = $scope.gridApi.grid.getVisibleRows();
                            var dataKorppi = "";
                            var fieldname = window.prompt('Korppi field name for points:', 'demo');
                            for (var i = 0; i < data.length; i++) {
                                dataKorppi += data[i].entity.name + ";" + fieldname + ";" + data[i].entity.total_points + "\n";
                            }
                            var filename = 'korppi_' + $scope.docId + '.txt';
                            if (filename === null) {
                                return;
                            }

                            // from https://stackoverflow.com/a/33542499
                            var blob = new Blob([dataKorppi], {type: 'text/plain'});
                            if (window.navigator.msSaveOrOpenBlob) {
                                window.navigator.msSaveBlob(blob, filename);
                            }
                            else {
                                var elem = window.document.createElement('a');
                                elem.href = window.URL.createObjectURL(blob);
                                elem.download = filename;
                                document.body.appendChild(elem);
                                elem.click();
                                document.body.removeChild(elem);
                            }
                        });
                    },
                    order: 210
                },
                {
                    title: 'Enable instant update',
                    action: function ($event) {
                        $scope.instantUpdate = true;
                    },
                    shown: function () {
                        return !$scope.instantUpdate;
                    }
                },
                {
                    title: 'Disable instant update',
                    action: function ($event) {
                        $scope.instantUpdate = false;
                    },
                    shown: function () {
                        return $scope.instantUpdate;
                    }
                }
            ],
            rowTemplate: "<div ng-dblclick=\"grid.appScope.fireUserChange(row, true)\" ng-repeat=\"(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name\" class=\"ui-grid-cell\" ng-class=\"{ 'ui-grid-row-header-cell': col.isRowHeader }\" ui-grid-cell></div>"
        };
    }]);
