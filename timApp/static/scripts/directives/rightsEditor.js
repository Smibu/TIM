/* globals angular, moment */
var timApp = angular.module('timApp');

timApp.directive("rightsEditor", ['$window', '$log', '$http', function ($window, $log, $http) {
    "use strict";
    return {
        restrict: 'E',
        scope: {
            itemId: '=?',
            urlRoot: '@?',
            accessTypes: '=?',
            control: '=?'
        },
        templateUrl: "/static/templates/rightsEditor.html",
        link: function ($scope, $element) {

        },

        controller: function ($scope, $element, $attrs) {
            var sc = $scope;
            sc.internalControl = sc.control || {};
            sc.grouprights = [];
            sc.timeOpt = {};
            sc.selectedRight = null;
            sc.timeOpt.type = 'always';
            sc.timeOpt.durationType = 'hours';
            sc.timeOpt.durationAmount = 4;
            sc.durationTypes = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
            sc.datePickerOptionsFrom = {
                format: 'D.M.YYYY HH:mm:ss',
                defaultDate: moment(),
                showTodayButton: true
            };
            sc.datePickerOptionsTo = {
                format: 'D.M.YYYY HH:mm:ss',
                defaultDate: moment(),
                showTodayButton: true
            };
            if (sc.accessTypes) {
                sc.accessType = sc.accessTypes[0];
            }

            sc.showAddRightFn = function (type) {
                sc.accessType = type;
                sc.selectedRight = null;
                sc.addingRight = true;
                sc.focusEditor = true;
            };

            sc.removeConfirm = function (group, type) {
                if ($window.confirm("Remove " + type + " right from " + group.name + "?")) {
                    sc.removePermission(group, type);
                }
            };

            sc.getPermissions = function () {
                if (!sc.urlRoot || !sc.itemId) {
                    return;
                }
                $http.get('/' + sc.urlRoot + '/get/' + sc.itemId).success(function (data, status, headers, config) {
                    sc.grouprights = data.grouprights;
                    if (data.accesstypes) {
                        sc.accessTypes = data.accesstypes;
                        if (!sc.accessType) {
                            sc.accessType = sc.accessTypes[0];
                        }
                    }
                }).error(function (data, status, headers, config) {
                    $window.alert("Could not fetch permissions.");
                });
            };

            sc.removePermission = function (right, type) {
                $http.put('/' + sc.urlRoot + '/remove/' + sc.itemId + '/' + right.gid + '/' + type, {}).success(
                    function (data, status, headers, config) {
                        sc.getPermissions();
                    }).error(function (data, status, headers, config) {
                    $window.alert(data.error);
                });
            };

            sc.cancel = function () {
                sc.addingRight = false;
                sc.selectedRight = null;
            };

            sc.editingRight = function () {
                return sc.selectedRight !== null;
            };

            sc.addOrEditPermission = function (groupname, type) {
                $http.put('/' + sc.urlRoot + '/add/' + sc.itemId + '/' + groupname.split('\n').join(';') + '/' + type.name,
                    sc.timeOpt).success(
                    function (data, status, headers, config) {
                        sc.getPermissions();
                        sc.cancel();
                    }).error(function (data, status, headers, config) {
                    $window.alert(data.error);
                });
            };

            sc.getPlaceholder = function () {
                return 'enter username(s)/group name(s) separated by semicolons' + (sc.listMode ? ' or newlines' : '');
            };

            sc.getGroupDesc = function (group) {
                return group.fullname ? group.fullname + ' (' + group.name + ')' : group.name;
            };

            sc.shouldShowBeginTime = function (group) {
                // having -1 here (instead of 0) avoids "begins in a few seconds" right after adding a right
                return moment().diff(group.accessible_from, 'seconds') < -1;
            };

            sc.shouldShowEndTime = function (group) {
                return group.accessible_to !== null && moment().diff(group.accessible_to) <= 0;
            };

            sc.shouldShowEndedTime = function (group) {
                return group.accessible_to !== null && moment().diff(group.accessible_to) > 0;
            };

            sc.shouldShowDuration = function (group) {
                return group.duration !== null && group.accessible_from === null;
            };

            sc.showClock = function (group) {
                return group.duration !== null || group.accessible_to !== null;
            };

            // TODO make duration editor its own component
            sc.$watchGroup(['timeOpt.durationAmount', 'timeOpt.durationType'], function (newValues, oldValues, scope) {
                sc.timeOpt.duration = moment.duration(sc.timeOpt.durationAmount, sc.timeOpt.durationType);
            });

            sc.editRight = function (group) {
                sc.groupName = group.name;
                sc.accessType = {id: group.access_type, name: group.access_name};
                sc.addingRight = false;
                sc.selectedRight = group;
                sc.timeOpt.type = 'range';
                sc.timeOpt.from = moment(group.accessible_from);
                if (group.accessible_to) {
                    sc.timeOpt.to = moment(group.accessible_to);
                } else {
                    sc.timeOpt.to = null;
                }

                if (group.duration) {
                    var d = moment.duration(group.duration);
                    sc.timeOpt.type = 'duration';
                    for (var i = sc.durationTypes.length - 1; i >= 0; --i) {
                        var amount = d.as(sc.durationTypes[i]);
                        if (parseInt(amount) === amount || i === 0) {
                            sc.timeOpt.durationType = sc.durationTypes[i];
                            sc.timeOpt.durationAmount = amount;
                            break;
                        }
                    }
                }
            };

            sc.getPermissions();
        }
    };
}]);
