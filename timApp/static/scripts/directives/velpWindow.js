/**
 * Created by Seppo Tarvainen on 25.11.2016.
 *
 * @module velpWindow
 * @author Seppo Tarvainen
 * @licence MIT
 */


// var UNDEFINED = "undefined";
var colorPalette = ["blueviolet", "darkcyan", "orange", "darkgray", "cornflowerblue", "coral", "goldenrod", "blue"];

/**
 * Angular directive for velp selection
 */
timApp.directive('velpWindow', function () {
    "use strict";

    return {
        templateUrl: "/static/templates/velpWindow.html",
        scope: {
            velp: "=",
            velpGroups: "=", // all velpgroups, not just selected ones
            advancedOn: "=",
            labels: "=",
            index: "@"
        },
        controller: 'VelpWindowController'

    };
});

/**
 * Controller for velp Window
 * @lends module:velpWindow
 */
timApp.controller('VelpWindowController', ['$scope', function ($scope) {
    "use strict";
    console.log($scope.velp);
    $scope.original = JSON.parse(JSON.stringify($scope.velp)); // clone object

    $scope.newLabel = {content: "", selected: true, valid: true};
    $scope.labelToEdit = {content: "", selected: false, edit: false, valid: true};

    var doc_id = $scope.$parent.docId;

    /**
     * Toggles velp for editing. If another velp is currently open,
     * this method closes it.
     */
    $scope.toggleVelpToEdit = function () {
        var lastEdited = $scope.$parent.getVelpUnderEdit();
        console.log($scope.$parent.getVelpUnderEdit());
        if (lastEdited.edit && lastEdited.id !== $scope.velp.id){
            $scope.$parent.resetEditVelp();
        }

        $scope.velp.edit = !$scope.velp.edit;
        if (!$scope.velp.edit){
            $scope.cancelEdit();
        }

        $scope.$parent.setVelpToEdit($scope.velp, $scope.cancelEdit);
    };


    /**
     * Saves velp to database
     * @param form
     */
    $scope.saveVelp = function (form) {
        if (!form.$valid) return;

        form.$setPristine();

        $scope.$parent.makePostRequest("/{0}/update_velp".replace('{0}', doc_id), $scope.velp, function (json) {
            $scope.original = JSON.parse(JSON.stringify($scope.velp)); // clone object
            $scope.toggleVelpToEdit();
        });
    };

    /**
     * Cancel edit and restore velp back to its original version
     */
    $scope.cancelEdit = function () {
        $scope.velp = JSON.parse(JSON.stringify($scope.original));
        $scope.velp.edit = false;
    };

    $scope.useVelp = function () {
        if (!$scope.velp.edit && !$scope.notAnnotationRights($scope.velp.points)) {
            $scope.$parent.useVelp($scope.velp);
        }
    };

    /**
     * Detect user right to annotation to document.
     * @param points - Points given in velp or annotation
     * @returns {boolean} - Right to make annotations
     */
    $scope.notAnnotationRights = function (points) {
        if ($scope.$parent.item.rights.teacher) {
            return false;
        } else {
            if (points === null) {
                return false;
            } else {
                return true;
            }
        }
    };

    $scope.isVelpValid = function () {
        if (typeof $scope.velp.content === UNDEFINED)
            return false;
        // TODO: check rights for velp groups
        return $scope.isSomeVelpGroupSelected() && $scope.velp.content.length > 0 ;
    };

    $scope.setLabelValid = function (label) {
        label.valid = label.content.length > 0;
    };

    /**
     * Returns whether the velp contains the label or not.
     * @method isLabelInVelp
     * @param label - Label to check
     * @returns {boolean} Whether the velp contains the label or not.
     */
    $scope.isLabelInVelp = function (label) {
        return $scope.velp.labels.indexOf(label.id) >= 0;
    };


    /**
     * Checks whether the velp contains the velp group.
     * @method isGroupInVelp
     * @param group - Velp group to check
     * @returns {boolean} Whether the velp contains the velp group or not
     */
    $scope.isGroupInVelp = function (group) {
        if (typeof $scope.velp.velp_groups === UNDEFINED || typeof group.id === UNDEFINED)
            return false;
        return $scope.velp.velp_groups.indexOf(group.id) >= 0;
    };

    /**
     * Updates the labels of the velp.
     * @method updateVelpLabels
     * @param label - Label to be added or removed from the velp
     */
    $scope.updateVelpLabels = function (label) {

        var index = $scope.velp.labels.indexOf(label.id);
        if (index < 0) {
            $scope.velp.labels.push(label.id);
        }
        else if (index >= 0) {
            $scope.velp.labels.splice(index, 1);
        }
    };

    /**
     * Updates velp groups of this velp.
     * @method updateVelpGroups
     * @param group - Group to be added or removed from the velp
     */
    $scope.updateVelpGroups = function (group) {
        var index = $scope.velp.velp_groups.indexOf(group.id);
        if (index < 0) {
            $scope.velp.velp_groups.push(group.id);
        }
        else if (index >= 0) {
            $scope.velp.velp_groups.splice(index, 1);
        }
    };


    /**
     * Checks if the velp has any velp groups selected.
     * @method isSomeVelpGroupSelected
     * @returns {boolean} Whether velp has any groups selected or not
     */
    $scope.isSomeVelpGroupSelected = function () {
        if (typeof $scope.velp.velp_groups === UNDEFINED)
            return false;
        return $scope.velp.velp_groups.length > 0;
    };

    /**
     * Adds new label to this velp.
     * @method addLabel
     */
    $scope.addLabel = function () {

        if ($scope.newLabel.content.length < 1) {
            $scope.newLabel.valid = false;
            return;
        }

        var labelToAdd = {
            content: $scope.newLabel.content,
            language_id: "FI", // TODO: Change to user language
            selected: false
        };

        console.log(labelToAdd);


        $scope.$parent.makePostRequest("/add_velp_label", labelToAdd, function (json) {
            labelToAdd.id = parseInt(json.data.id);
            $scope.resetNewLabel();
            $scope.labels.push(labelToAdd);
            //$scope.labelAdded = false;
            $scope.velp.labels.push(labelToAdd.id);
        });
    };

    /**
     * Selects the label for editing.
     * @method toggleLabelToEdit
     * @param label - Label to edit
     */
    $scope.toggleLabelToEdit = function (label) {

        if ($scope.labelToEdit.edit && label.id === $scope.labelToEdit.id){
            $scope.cancelLabelEdit(label);
            return;
        }

        if ($scope.labelToEdit.edit) {
            $scope.labelToEdit.edit = false;
            for (var i = 0; i < $scope.labels.length; i++) {
                $scope.labels[i].edit = false;
            }
        }

        label.edit = true;
        copyLabelToEditLabel(label);
        $scope.setLabelValid($scope.labelToEdit);

    };

    $scope.cancelLabelEdit = function (label) {
        label.edit = false;
        $scope.labelToEdit = {content: "", selected: false, edit: false, valid: true};
    };

    var copyLabelToEditLabel = function (label) {
        for (var key in label){
            if(!label.hasOwnProperty(key)) continue;

            $scope.labelToEdit[key] = label[key];
        }
    };



    /**
     * Edits the label according to the $scope.labelToedit variable.
     * All required data exists in the $scope.labelToedit variable,
     * including the ID of the label.
     * TODO: This can be simplified
     * @method editLabel
     */
    $scope.editLabel = function () {
        if ($scope.labelToEdit.content.length < 1) {
            return;
        }

        var updatedLabel = null;
        for (var i = 0; i < $scope.labels.length; i++) {
            if ($scope.labels[i].id === $scope.labelToEdit.id) {
                $scope.labelToEdit.edit = false;
                $scope.labels[i].content = $scope.labelToEdit.content;
                $scope.labels[i].edit = false;
                updatedLabel = $scope.labels[i];
                break;
            }
        }

        $scope.$parent.makePostRequest("/update_velp_label", updatedLabel, function (json) {
        });
    };


    /**
     * Reset new label information to the initial (empty) state.
     * @method resetNewLabel
     */
    $scope.resetNewLabel = function () {
        $scope.newLabel = {content: "", selected: true, valid: true};
    };

    /**
     * Return true if user has teacher rights.
     * @returns {boolean}
     */
    $scope.allowChangePoints = function () {
        return $scope.$parent.$parent.item.rights.teacher;
    };


    /**
     * Get color for the object from colorPalette variable.
     * @method getColor
     * @param index - Index of the color in the colorPalette variable (modulo by lenght of color palette)
     * @returns {string} String representation of the color
     */
    $scope.getColor = function (index) {
        return colorPalette[index % colorPalette.length];
    };

}]);