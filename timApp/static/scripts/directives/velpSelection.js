/**
 * The directive retrieves all the data from the server including velps, labels, velp groups and annotations.
 * The directive also handles majority of the functionality that is relevant in handling velps, labels and velp groups.
 * 
 * @module velpSelection
 * @author Joonas Lattu
 * @author Petteri Palojärvi
 * @author Seppo Tarvainen
 * @licence MIT
 * @copyright 2016 Timber project members
 */

var angular;
var timApp = angular.module('timApp');


var UNDEFINED = "undefined";

/**
 * Angular directive for velp selection
 */
timApp.directive('velpSelection', function () {
    "use strict";
    return {
        templateUrl: "/static/templates/velpSelection.html",
        controller: 'VelpSelectionController'
    };
});


/**
 * Controller for velp selection
 * @lends module:velpSelection
 */
timApp.controller('VelpSelectionController', ['$scope', '$window', '$http', '$q', function ($scope, $window, $http, $q) {
    "use strict";
    var console = $window.console;

    // Data
    $scope.velps = [];
    $scope.annotations = [];
    $scope.labels = [];
    $scope.velpGroups = [];

    $scope.advancedOn = false;
    $scope.newVelp = {content: "", points: "", labels: [], edit: false, id: -2, velp_groups: []};
    $scope.velpToEdit = {content: "", points: "", labels: [], edit: false, id: -1, velp_groups: [], orig: {}};
    $scope.newLabel = {content: "", selected: false, edit: false, valid: true};
    $scope.labelToEdit = {content: "", selected: false, edit: false, id: -3};
    $scope.newVelpGroup = {name: "", target_type: 0};
    $scope.selectedLabels = [];
    $scope.settings = {selectedAllShows: false, selectedAllDefault: false};
    $scope.submitted = {velp: false, velpGroup: false};

    $scope.groupAttachment = {target_type: 1, id: null};

    $scope.groupSelections = {};
    $scope.groupDefaults = {};

    // Dictionaries for easier searching: Velp ids? Label ids? Annotation ids?
    var doc_id = $scope.docId;
    var default_velp_group = {id: -1, name: "No access to default group", edit_access: false, show: true, default: true}; // TODO Use route to add this information
    var default_personal_velp_group = {id: -2, name: "Personal default"};

    $scope.visible_options = {
                "type": "select",
                "value": 4,
                "values": [1, 2, 3, 4],
                "names": ["Just me", "Document owner", "Teachers", "Everyone"]
    };

    // Get velp ordering and selected labels in this document
    $scope.velpSettings = {
        orderKey: "velpOrdering_" + doc_id,
    };
    $scope.velpSettings.order = getVelpSettings();


    // Get velpgroup data
    var promises = [];
    promises.push();
    var p = $http.get('/{0}/get_velp_groups'.replace('{0}', doc_id));
    promises.push(p);
    p.success(function (data) {
        $scope.velpGroups = data;

        // Get default velp group data

        p = $http.get('/{0}/get_default_velp_group'.replace('{0}', doc_id));
        promises.push(p);
        p.success(function (data) {
            default_velp_group = data;

            // If doc_default exists already for some reason but isn't a velp group yet, remove it from fetched velp groups
            $scope.velpGroups.some(function (g) {
                if (g.name === default_velp_group.name && default_velp_group.id < 0) {
                    var extraDefaultIndex = $scope.velpGroups.indexOf(g);
                    $scope.velpGroups.push(default_velp_group);
                    return $scope.velpGroups.splice(extraDefaultIndex, 1);
                }
            });

            if (default_velp_group.edit_access) {
                $scope.velpGroups.some(function (g) {
                    if (g.id === default_velp_group.id)
                        g.selected = true;
                });
                default_velp_group.selected = true;
                $scope.newVelp.velp_groups.push(default_velp_group.id);
            }

            // $scope.groupDefaults["0"] = [default_velp_group];

            // Get personal velp group data
            p = $http.get('/get_default_personal_velp_group');
            promises.push(p);
            p.success(function (data) {
                default_personal_velp_group = {id: data.id, name: data.name};

                if (data.created_new_group) {
                    $scope.velpGroups.push(data);
                }

                if (!default_velp_group.edit_access) {
                    $scope.newVelp.velp_groups.push(default_personal_velp_group.id);
                    /*$scope.velpGroups.some(function (g) {
                        if (g.id === default_personal_velp_group.id)
                            g.selected = true;
                    });*/
                }

                if (default_personal_velp_group.id < 0)
                    $scope.velpGroups.push(default_velp_group);

                /*
                $scope.velpGroups.forEach(function(g) {
                    if (g.id === default_personal_velp_group.id){
                        if (typeof g.default === UNDEFINED){
                            g.default = true;
                        }

                    } else if (g.id === default_velp_group.id){

                        if (typeof g.default === UNDEFINED){
                            g.default = true;
                        }

                        //g.show = true;
                        //g.default = true;
                    }
                });
                */
                $scope.updateVelpList();
            });

            if (default_velp_group.id < 0)
                $scope.velpGroups.push(default_velp_group);


        });

        // Get velp and annotation data
        p = $http.get('/{0}/get_velps'.replace('{0}', doc_id));
        promises.push(p);
        p.success(function (data) {
            $scope.velps = data;
            $scope.velps.forEach(function (v) {
                v.used = 0;
                v.edit = false;
                if (typeof v.labels === UNDEFINED)
                    v.labels = [];
            });
        });

        /*
         $http.get('/get_default_personal_velp_group').success(function (data) {
         default_personal_velp_group = {id: data.id, name: data.name};
         if (data.created_new_group) {
         $scope.velpGroups.push(data);
         }
         if (!default_velp_group.edit_access) {
         $scope.newVelp.velp_groups.push(default_personal_velp_group.id);
         $scope.velpGroups.some(function (g) {
         if (g.id === default_personal_velp_group.id)
         return g.selected = true;
         });
         }
         });
         */
        /*
        p = $http.get('/{0}/get_annotations'.replace('{0}', doc_id));
        promises.push(p);
        p.success(function (data) {
            $scope.annotations = data;
            $scope.loadDocumentAnnotations();
        });
        */
        // Get label data
        p = $http.get('/{0}/get_velp_labels'.replace('{0}', doc_id));
        promises.push(p);
        p.success(function (data) {
            $scope.labels = data;
            $scope.labels.forEach(function (l) {
                l.edit = false;
                l.selected = false;
            });
        });

        p = $http.get('/{0}/get_velp_group_personal_selections'.replace('{0}', doc_id));
        promises.push(p);
        p.success(function (data) {
            $scope.groupSelections = data;
            if (!$scope.groupSelections.hasOwnProperty("0"))
                $scope.groupSelections["0"] = [];

            var docSelections = $scope.groupSelections["0"];

            $scope.velpGroups.forEach(function (g) {
                g.show = false;
                for (var i = 0; i < docSelections.length; i++) {
                    if (docSelections[i].id === g.id && docSelections[i].selected) {
                        g.show = true;
                        break;
                    }
                }
            });
            //$scope.updateVelpList();

        });

        p = $http.get('/{0}/get_velp_group_default_selections'.replace('{0}', doc_id));
        promises.push(p);
        p.success(function (data) {
            $scope.groupDefaults = data;

            var docDefaults = $scope.groupDefaults["0"];

            $scope.velpGroups.forEach(function (g) {

                for (var i = 0; i < docDefaults.length; i++) {
                    if (docDefaults[i].id === g.id && docDefaults[i].selected) {
                        g.default = true;
                        break;
                    }
                }
            });
            //$scope.updateVelpList();

        });

        $q.all(promises).then(function(){
            $scope.updateVelpList();
        });

    });

    // Methods


    function getVelpSettings() {

        if (typeof $window.localStorage.getItem($scope.velpSettings.orderKey) === UNDEFINED){
            return "labels";
        }
        console.log($window.localStorage.getItem($scope.velpSettings.orderKey));
        return $window.localStorage.getItem($scope.velpSettings.orderKey);
    };

    $scope.changeOrdering = function (order) {
        console.log(order);
        $window.localStorage.setItem($scope.velpSettings.orderKey, order);
    };

    /**
     * Return true if user has teacher rights.
     * @returns {boolean}
     */

    $scope.allowChangePoints = function () {
        return $scope.$parent.item.rights.teacher;
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

    /**
     * Toggles the label's selected attribute.
     * @method toggleLabel
     * @param label - Label to toggle
     */
    $scope.toggleLabel = function (label) {
        label.selected = !label.selected;
        var labelIndex = $scope.selectedLabels.indexOf(label.id);
        if (labelIndex < 0) {
            $scope.selectedLabels.push(label.id);
        } else {
            $scope.selectedLabels.splice(labelIndex, 1);
        }

    };

    /**
     * Toggles the label's edit attribute.
     * @method toggleLabelToEdit
     * @param label - Label to edit
     */
    $scope.toggleLabelToEdit = function (label) {
        label.edit = !label.edit;
    };

    /*
     * Toggles advanced view on and off
     * @method toggleAdvancedShow
     */
    $scope.toggleAdvancedShow = function () {
        $scope.advancedOn = !$scope.advancedOn;
    };

    /**
     * Adds new label tp the specified velp.
     * @method addLabel
     * @param velp - Velp where the label is to be added.
     */
    $scope.addLabel = function (velp) {

        if ($scope.newLabel.content.length < 1) {
            $scope.newLabel.valid = false;
            return;
        }

        var labelToAdd = {
            content: $scope.newLabel.content,
            language_id: "FI", // TODO: Change to user language
            selected: false
        };

        $scope.makePostRequest("/add_velp_label", labelToAdd, function (json) {
            labelToAdd.id = parseInt(json.data.id);
            $scope.resetNewLabel();
            $scope.labels.push(labelToAdd);
            $scope.labelAdded = false;
            velp.labels.push(labelToAdd.id);
        });

    };

    /**
     * Returns whether the velp contains the label or not.
     * @method isLabelInVelp
     * @param velp - Velp to check
     * @param label - Label to check
     * @returns {boolean} Whether the velp contains the label or not.
     */
    $scope.isLabelInVelp = function (velp, label) {
        return velp.labels.indexOf(label.id) >= 0;
    };

    /**
     * Adds a new velp on form submit event.
     * @method addVelp
     * @param form - Form information
     */
    $scope.addVelp = function (form) {
        var valid = form.$valid;
        $scope.submitted.velp = true;
        if (!valid) return;

        // Form is valid:
        form.$setPristine();

        if ($scope.isGroupInVelp($scope.newVelp, default_velp_group) && default_velp_group.id === -1) {
            // $scope.isGroupInVelp($scope.newVelp, -1);
            //$scope.newVelp.velp_groups = [default_velp_group];

            var old_default_group = default_velp_group;
            $scope.generateDefaultVelpGroup(function () {

                var oldGroupIndex = $scope.newVelp.velp_groups.indexOf(old_default_group.id); // -1 = old
                if (oldGroupIndex >= 0)
                    $scope.newVelp.velp_groups.splice(oldGroupIndex, 1);


                $scope.newVelp.velp_groups.push(default_velp_group.id);

                addNewVelpToDatabase();
            });

        } else if ($scope.newVelp.velp_groups.length > 0) {
            addNewVelpToDatabase();
        }

        $scope.updateVelpList();
    };

    /**
     * Adds a new velp to the database. Requires values in `$scope.newVelp` variable.
     * @method addNewVelpToDatabase
     */
    var addNewVelpToDatabase = function () {
        var velpToAdd = {
            labels: $scope.newVelp.labels,
            used: 0,
            points: $scope.newVelp.points,
            content: $scope.newVelp.content,
            language_id: "FI",
            icon_id: null,
            valid_until: null,
            visible_to: $scope.visible_options.value,
            velp_groups: JSON.parse(JSON.stringify($scope.newVelp.velp_groups))

        };
        $scope.velpToEdit.edit = false;
        $scope.newVelp.edit = false;

        $scope.makePostRequest("/add_velp", velpToAdd, function (json) {
            velpToAdd.id = parseInt(json.data);

            $scope.resetNewVelp();
            $scope.velpToEdit = {content: "", points: "", labels: [], edit: false, id: -1};

            $scope.velps.push(velpToAdd);
            $scope.submitted.velp = false;
            //$scope.resetLabels();
        });
    };


    /**
     * Deselects all the labels.
     * @method deselectLabels
     */
    $scope.deselectLabels = function () {
        for (var i = 0; i < $scope.labels.length; i++) {
            if ($scope.labels[i].selected) {
                $scope.toggleLabel($scope.labels[i]);
            }
        }
    };

    /**
     * Selects the label for editing.
     * @method selectLabelToEdit
     * @param label - Label to edit
     */
    $scope.selectLabelToEdit = function (label) {
        if (label.id === $scope.labelToEdit.id && label.edit) {
            label.edit = false;
            $scope.labelToEdit = {content: "", selected: false, edit: false};
            return;
        }

        if ($scope.labelToEdit.edit) {
            $scope.labelToEdit.edit = false;
            for (var i = 0; i < $scope.labels.length; i++) {
                $scope.labels[i].edit = false;
            }
        }

        label.edit = true;
        $scope.labelToEdit = Object.create(label);
    };


    /**
     * Updates the labels of the velp.
     * @method updateVelpLabels
     * @param velp - Velp to update
     * @param label - Label to be added or removed from the velp
     */
    $scope.updateVelpLabels = function (velp, label) {

        var index = velp.labels.indexOf(label.id);
        if (index < 0) {
            velp.labels.push(label.id);
        }
        else if (index >= 0) {
            velp.labels.splice(index, 1);
        }
    };

    /**
     * Selects velp to edit
     * @method selectVelpToEdit
     * @param velp - Velp to edit
     */
    $scope.selectVelpToEdit = function (velp) {

        if (velp.id === $scope.velpToEdit.id && velp.edit) {
            velp.edit = false;
            $scope.velpToEdit = {content: "", points: "", labels: [], edit: false};
            return;
        }

        if ($scope.velpToEdit.edit) {
            $scope.velpToEdit.edit = false;
            for (var i = 0; i < $scope.velps.length; i++) {
                $scope.velps[i].edit = false;
            }
            $scope.newVelp.edit = false;
        }

        velp.edit = true;

        $scope.velpToEdit = (JSON.parse(JSON.stringify(velp)));
    };

    /**
     * Edits velp according to the $scope.velpToEdit variable.
     * All required data exists in the $scope.velpToedit variable,
     * including the ID of the velp.
     * @method editVelp
     * @param form - Velp form

    $scope.editVelp = function (form) {
        var valid = form.$valid;
        $scope.submitted.velp = true;
        if (!valid) return;

        form.$setPristine();

        // TODO: Make velpGroups to [{'id':1, 'selected':'True'}]

        if ($scope.isGroupInVelp($scope.velpToEdit, default_velp_group) && default_velp_group.id === -1) {

            var old_default_group = default_velp_group;
            $scope.generateDefaultVelpGroup(function () {

                var oldGroupIndex = $scope.velpToEdit.velp_groups.indexOf(old_default_group.id); // -1 = old
                if (oldGroupIndex >= 0)
                    $scope.velpToEdit.velp_groups.splice(oldGroupIndex, 1);
                $scope.velpToEdit.velp_groups.push(default_velp_group.id);

                $scope.makePostRequest("/{0}/update_velp".replace('{0}', doc_id), $scope.velpToEdit, function (json) {
                });
            });


        } else if ($scope.velpToEdit.velp_groups.length > 0) {
            $scope.makePostRequest("/{0}/update_velp".replace('{0}', doc_id), $scope.velpToEdit, function (json) {
            });
        }

        for (var i = 0; i < $scope.velps.length; i++) {
            if ($scope.velps[i].id === $scope.velpToEdit.id) {
                $scope.velpToEdit.edit = false;
                $scope.velps[i] = $scope.velpToEdit;
                break;
            }
        }

        $scope.resetEditVelp();
    };
     */

    /**
     * Selects or deselects velp for being edited.
     * @param velp - Velp information, contains all edited info
     * @param resetFuction - Function to execute in cancel edit
     */
    $scope.setVelpToEdit = function (velp, resetFunction) {
        $scope.velpToEdit = velp;
        $scope.resetEditVelp = resetFunction;
    };

    /**
     * Returns whether velp is being edited or not.
     * @returns Boolean
     */
    $scope.getVelpUnderEdit = function () {
        return $scope.velpToEdit;
    };

    /**
     * Generates the default velp group and runs the custom method.
     * @method generateDefaultVelpGroup
     * @param method - Method to be run after this mehtod.
     */
    $scope.generateDefaultVelpGroup = function (method) {
        if (default_velp_group.edit_access) {
            $scope.makePostRequest('/{0}/create_default_velp_group'.replace('{0}', doc_id), "{}", function (json) {
                var new_default_velp_group = json.data;
                new_default_velp_group.default = true;

                var index = $scope.velpGroups.indexOf(default_velp_group);
                $scope.velpGroups.splice(index, 1);

                if ($scope.velpGroups.indexOf(new_default_velp_group) < 0)
                    $scope.velpGroups.push(new_default_velp_group);

                default_velp_group = new_default_velp_group;
                console.log(new_default_velp_group);
                method();
            });
        }
        else {
            // No edit access to default velp group
        }
    };

    /**
     * Edits the label according to the $scope.labelToedit variable.
     * All required data exists in the $scope.labelToedit variable,
     * including the ID of the label.
     * @method editLabel
     */
    $scope.editLabel = function () {
        if ($scope.labelToEdit.content.length < 1) {
            $scope.labelToEdit.edit = false;
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

        $scope.makePostRequest("/update_velp_label", updatedLabel, function (json) {
        });
    };

    /**
     * Reset new velp information to the initial (empty) state.
     * @method resetNewVelp
     */
    $scope.resetNewVelp = function () {
        $scope.newVelp = {
            content: "",
            points: "",
            labels: [],
            edit: false,
            id: -2,
            velp_groups: $scope.newVelp.velp_groups
        };
    };

    /**
     * Resets $scope.velpToEdit variable to the initial (empty) state.
     * @method resetEditVelp
     */
    $scope.resetEditVelp = function(){
            $scope.velpToEdit = {content: "", points: "", labels: [], edit: false, id: -1, velp_groups: []};
    };

    /**
     * Reset new label information to the initial (empty) state.
     * @method resetNewLabel
     */
    $scope.resetNewLabel = function () {
        $scope.newLabel = {content: "", selected: true, valid: true};
    };

    /** Velpgroup methods **/

    /**
     * Updates the velp list according to how the velp groups are selected in the area.
     * @method updateVelpList
     */
    $scope.updateVelpList = function () {
        $scope.velpGroups.forEach(function (g) {
            if ($scope.selectedElement !== null && $scope.groupAttachment.target_type === 1) {
                g.show = $scope.isVelpGroupShownHere(g.id, $scope.selectedElement.id);
                g.default = $scope.isVelpGroupDefaultHere(g.id, $scope.selectedElement.id);
            }
            else {
                g.show = $scope.isVelpGroupShownHere(g.id, 0);
                g.default = $scope.isVelpGroupDefaultHere(g.id, 0);
            }
        });
    };

    /**
     * Return whether the group is shown based on the various selected and default values.
     * @method isVelpGroupShownHere
     * @param groupId - VelpGroup ID
     * @param paragraphId - Paragraph ID or "0" for the document
     * @returns {boolean} Whether the velp group is shown here or not
     */
    $scope.isVelpGroupShownHere = function (groupId, paragraphId) {
        var returnValue;
        // Are we checking for the whole document? This "if" might be unnecessary.
        if (paragraphId === "0") {
            returnValue = $scope.lazyIsVelpGroupSelectedInParagraph(groupId, paragraphId);
            if (returnValue !== null)
                return returnValue;
            // Not set for the document, we'll try the defaults instead.
            returnValue = $scope.lazyIsVelpGroupDefaultInParagraph(groupId, paragraphId);
            if (returnValue !== null)
                return returnValue;
        }
        else {
            // First check "selected" attributes for paragraph.
            returnValue = $scope.lazyIsVelpGroupSelectedInParagraph(groupId, paragraphId);
            if (returnValue !== null)
                return returnValue;
            // Found nothing, we try the defaults instead.
            returnValue = $scope.isVelpGroupDefaultHere(groupId, paragraphId);
            if (returnValue !== null)
                return returnValue;
        }
        // Ok, hard coded ones left:
        return $scope.isVelpGroupDefaultFallBack(groupId);
    };

    /**
     * Returns whether the velp group is default in specified paragraph (or document) or not.
     * @method isVelpGroupDefaultHere
     * @param groupId - Velp group ID
     * @param paragraphId - Paragraph ID or "0" for the document
     * @returns {boolean} Whether the velp group is default here or not.
     */
    $scope.isVelpGroupDefaultHere = function (groupId, paragraphId) {
        var returnValue;
        // First check defaults here
        returnValue = $scope.lazyIsVelpGroupDefaultInParagraph(groupId, paragraphId);
        if (returnValue !== null)
            return returnValue;
        // and then try document instead. If we started with a document, this is wasted work.
        returnValue = $scope.lazyIsVelpGroupDefaultInParagraph(groupId, "0");
        if (returnValue !== null)
            return returnValue;
        return $scope.isVelpGroupDefaultFallBack(groupId);
    };

    /**
     * Checks whether the given velp group is either personal default or document default group.
     * Personal default group and the document default group have always default, unless the user has
     * specified otherwise.
     * @method isVelpGroupDefaultFallBack
     * @param groupId - Velp group ID
     * @returns {boolean} Whether the group is personal default or document default group or not.
     */
    $scope.isVelpGroupDefaultFallBack = function (groupId) {
        return (groupId === default_personal_velp_group.id || groupId === default_velp_group.id);
    };

    /**
     * Helper function for checking if the velp group is shown in the paragraph or not.
     * Despite the name, can check document selections as well.
     * @method lazyIsVelpGroupSelectedInParagraph
     * @param groupId - Velp group ID
     * @param paragraphId - Paragraph ID or "0" for the document
     * @returns true/false/null
     */
    $scope.lazyIsVelpGroupSelectedInParagraph = function (groupId, paragraphId) {
        return $scope.checkCollectionForSelected(groupId, paragraphId, $scope.groupSelections);
    };

    /**
     * Helper function for checking if the velp group is default in the paragraph or not.
     * Despite the name, can check document selections as well.
     * @method lazyIsVelpGroupDefaultInParagraph
     * @param groupId - Velp group ID
     * @param paragraphId - Paragraph ID or "0" for the document
     * @returns true/false/null
     */
    $scope.lazyIsVelpGroupDefaultInParagraph = function (groupId, paragraphId) {
        return $scope.checkCollectionForSelected(groupId, paragraphId, $scope.groupDefaults);
    };

    /**
     * Checks whether the collection is selected or not.
     * @method checkCollectionForSelected
     * @param groupId - Velp group ID
     * @param paragraphId - Paragraph ID or document "0".
     * @param collection - Shows or defaults
     * @returns {boolean|null} Whether the collection is selected or not. Null if paragraph is not found.
     */
    $scope.checkCollectionForSelected = function (groupId, paragraphId, collection) {
        if (collection.hasOwnProperty(paragraphId)) {
            var index;
            var selectionsHere = collection[paragraphId];
            for (var i = 0; i < selectionsHere.length; ++i) {
                if (selectionsHere[i].id === groupId) {
                    return selectionsHere[i].selected;
                }
            }
        }
        return null;
    };

    /**
     * Adds a velp group on form submit event.
     * @method addVelpGroup
     * @param form - Velp group form
     */
    $scope.addVelpGroup = function (form) {
        var valid = form.$valid;
        $scope.submitted.velpGroup = true;
        if (!valid) return;

        form.$setPristine();

        $scope.newVelpGroup.target_type = parseInt($scope.newVelpGroup.target_type);
        $scope.makePostRequest("/{0}/create_velp_group".replace('{0}', doc_id), $scope.newVelpGroup, function (json) {
            var group = json.data;
            group.selected = false;
            group.show = true;
            $scope.velpGroups.push(json.data);

            // TODO: show in selected area
        });
    };

    /**
     * Changes velp group (default or show) selection in the current element or in the document.
     * @method changeVelpGroupSelection
     * @param group - Velp group
     * @param type - "show" or "default"
     */
    $scope.changeVelpGroupSelection = function (group, type) {

        $scope.groupAttachment.target_type = parseInt($scope.groupAttachment.target_type);

        if ($scope.groupAttachment.target_type === 1 && $scope.selectedElement !== null) {
            group.target_id = $scope.selectedElement.id;
            group.target_type = 1;
        } else {
            group.target_id = "0";
            group.target_type = 0;
        }
        group.selection_type = type;

        var found = false;

        if (type === "show") {
            $scope.makePostRequest("/{0}/change_selection".replace('{0}', doc_id), group, function (json) {
            });

            $scope.groupSelections[group.target_id] = [];

                $scope.velpGroups.forEach(function (g) {
                    $scope.groupSelections[group.target_id].push({id: g.id, selected: g.show});
                });


            /*
            if (!$scope.groupSelections.hasOwnProperty(group.target_id))
                $scope.groupSelections[group.target_id] = [];

            var groups = $scope.groupSelections[group.target_id];
            for (var i = 0; i < groups.length; i++) {
                if (groups[i].id === group.id) {
                    groups[i].selected = group.show;
                    found = true;
                    break;
                }
            }
            if (!found) {
                $scope.groupSelections[group.target_id].push({id: group.id, selected: group.show});
            }
            */
        }
        else if (type === "default") {
            $scope.makePostRequest("/{0}/change_selection".replace('{0}', doc_id), group, function (json) {
            });

            $scope.groupDefaults[group.target_id] = [];

            $scope.velpGroups.forEach(function (g) {
                $scope.groupDefaults[group.target_id].push({id: g.id, selected: g.default});
            });


            /*if (!$scope.groupDefaults.hasOwnProperty(group.target_id))
                $scope.groupDefaults[group.target_id] = [];

            var defGroups = $scope.groupDefaults[group.target_id];
            found = false;
            for (var j = 0; j < defGroups.length; j++) {
                if (defGroups[j].id === group.id) {
                    defGroups[j].selected = group.show;
                    found = true;
                    break;
                }
            }
            if (!found) {
                $scope.groupDefaults[group.target_id].push({id: group.id, selected: group.default});
            }
            */
        }

        $scope.updateVelpList();
    };

    /**
     * Changes all velp group selections (defaults and shows).
     * @method changeAllVelpGroupSelections
     * @param type - "show" or "default"
     */
    $scope.changeAllVelpGroupSelections = function (type) {

        $scope.groupAttachment.target_type = parseInt($scope.groupAttachment.target_type);

        var targetID, targetType;

        if ($scope.groupAttachment.target_type === 1 && $scope.selectedElement !== null) {
            targetID = $scope.selectedElement.id;
            targetType = 1;
        } else {
            targetID = "0";
            targetType = 0;
        }

        if (type === "show") {
            $scope.groupSelections[targetID] = [];
            if (!$scope.settings.selectedAllShows) {

                $scope.velpGroups.forEach(function (g) {
                    $scope.groupSelections[targetID].push({id: g.id, selected: false});
                });
            } else {
                $scope.velpGroups.forEach(function (g) {
                    $scope.groupSelections[targetID].push({id: g.id, selected: true});
                });
            }

            $scope.makePostRequest("/{0}/change_all_selections".replace('{0}', doc_id), {
                'target_id': targetID, 'target_type': targetType, 'selection': $scope.settings.selectedAllShows,
                'selection_type': type
            }, function (json) {
            });


        }
        else if (type === "default") {
            $scope.groupDefaults[targetID] = [];

            if (!$scope.settings.selectedAllDefault) {
                $scope.velpGroups.forEach(function (g) {
                    $scope.groupDefaults[targetID].push({id: g.id, selected: false});
                });
            } else {

                $scope.velpGroups.forEach(function (g) {
                    $scope.groupDefaults[targetID].push({id: g.id, selected: true});
                });
            }

            $scope.makePostRequest("/{0}/change_all_selections".replace('{0}', doc_id), {
                'target_id': targetID, 'target_type': targetType, 'selection': $scope.settings.selectedAllDefault,
                'selection_type': type
            }, function (json) {
            });

        }

        $scope.updateVelpList();

    };

    /**
     * Sets all velp group show selections to defaults in the current element or in the document.
     * @method resetCurrentShowsToDefaults
     */
    $scope.resetCurrentShowsToDefaults = function () {

        var targetID;
        $scope.groupAttachment.target_type = parseInt($scope.groupAttachment.target_type);

        if ($scope.groupAttachment.target_type === 1 && $scope.selectedElement !== null) {
            targetID = $scope.selectedElement.id;
        } else {
            targetID = "0";
        }

        $scope.groupSelections[targetID] = JSON.parse(JSON.stringify($scope.groupDefaults[targetID]));
        $scope.makePostRequest("/{0}/reset_target_area_selections_to_defaults".replace('{0}', doc_id), {'target_id': targetID}, function (json) {
            $scope.updateVelpList();
        });
    };

    /**
     * Sets all the show-checkbox values according to the default-checkboxes.
     * @method resetAllShowsToDefaults
     */
    $scope.resetAllShowsToDefaults = function () {
        $scope.groupSelections = JSON.parse(JSON.stringify($scope.groupDefaults));

        $scope.makePostRequest("/{0}/reset_all_selections_to_defaults".replace('{0}', doc_id), null, function (json) {
            $scope.updateVelpList();
        });
    };

    /**
     * Changes default and show checkboxes according to selected element or document.
     * @method checkCheckBoxes
     * @param type - Paragraph ID or "0" for the document
     * @returns {boolean} Whether all velp groups are used in the selected element or document
     */
    $scope.checkCheckBoxes = function (type) {
        var targetID = null;

        if ($scope.groupAttachment.target_type === 1) {
            targetID = $scope.selectedElement.id;
        } else {
            targetID = "0";
        }

        if (type === "show" && typeof $scope.groupSelections[targetID] !== UNDEFINED) {
            return $scope.groupSelections[targetID].length === $scope.velpGroups.length;
        } else if (type === "default" && typeof $scope.groupDefaults[targetID] !== UNDEFINED) {
            return $scope.groupDefaults[targetID].length === $scope.velpGroups.length;
        }
    };

    /**
     * Gets all the velp groups of the specific velp.
     * @method getVelpsVelpGroups
     * @param velp - Velp whose velp groups are retrieved
     * @returns {Array} - Array of the velp's velp groups
     */
    $scope.getVelpsVelpGroups = function (velp) {
        var groups = [];

        for (var i = 0; i < velp.velp_groups.length; i++) {
            for (var j = 0; j < $scope.velpGroups.length; j++) {
                groups.push($scope.velpGroups[j]);
                groups[i].selected = velp.velp_groups.indexOf($scope.velpGroups[j].id) >= 0;
            }
        }
        return groups;
    };

    /**
     * Checks if the velp has any velp groups selected.
     * @method isSomeVelpGroupSelected
     * @param velp - Velp whose velp groups are checked
     * @returns {boolean} Whether velp has any groups selected or not
     */
    $scope.isSomeVelpGroupSelected = function (velp) {
        if (typeof velp.velp_groups === UNDEFINED)
            return false;
        return velp.velp_groups.length > 0;
    };

    /**
     * Checks if the velp can be added or modified. The velp has to have a name and
     * it has to be included in at least one velp group.
     * @method isVelpValid
     * @param velp - Velp to check
     * @returns {boolean} Whether the added or modified velp is valid or not.
     */
    $scope.isVelpValid = function (velp) {
        if (typeof velp.content === UNDEFINED)
            return false;
        return $scope.isSomeVelpGroupSelected(velp) && velp.content.length > 0;
    };

    /**
     * Checks whether the velp contains the velp group.
     * @method isGroupInVelp
     * @param velp - Velp to check
     * @param group - Velp group to check
     * @returns {boolean} Whether the velp contains the velp group or not
     */
    $scope.isGroupInVelp = function (velp, group) {
        if (typeof velp.velp_groups === UNDEFINED || typeof group.id === UNDEFINED)
            return false;
        return velp.velp_groups.indexOf(group.id) >= 0;
    };

    /**
     * Updates velp groups of the specified velp.
     * @method updateVelpGroups
     * @param velp - Velp to update
     * @param group - Group to be added or removed from the velp
     */
    $scope.updateVelpGroups = function (velp, group) {
        var index = velp.velp_groups.indexOf(group.id);
        if (index < 0) {
            velp.velp_groups.push(group.id);
        }
        else if (index >= 0) {
            velp.velp_groups.splice(index, 1);
        }
    };

    /**
     * Releases select tab.
     * @method releaseClicked
     */

    $scope.releaseClicked = function () {
                    var div = $("#selectVelpsDiv");
                    $scope.previewReleased = !($scope.previewReleased);
                    var top = div.offset().top;
                    var left = div.offset().left - 270;
                    var element = div.detach();
                    if (div.css("position") === "fixed") {
                        $('#selectVelpsStack').append(element);
                        // If preview has been clicked back in, save the preview position before making it static again
                        div.css("position", "static");
                        div.find(".draghandle").css("visibility", "hidden");
                        div.find(".closedraggable").css("visibility", "hidden");
                        div.css("display", "default");
                        div.css("padding", 0);

                        document.getElementById("releaseSelectVelpsButton").innerHTML = "&#8592;";



                    }
                    else {
                        // If preview has just been released or it was released last time editor was open
                        $('#velpMenu').append(element);
                        div.css("position", "fixed");
                        div.find(".draghandle").css("visibility", "visible");
                        div.find(".closedraggable").css("visibility", "visible");

                        div.css("display", "table");
                        div.css("width", "19em");
                        div.css("padding", 5);
                        div.css("z-index", 9999);
                        document.getElementById("releaseSelectVelpsButton").innerHTML = "&#8594;";

                        div.offset({'left': left, 'top': top});


                    }

                };
}]);

/**
 * Filter for ordering velps
 */
timApp.filter('filterByLabels', function () {
    "use strict";
    return function (velps, labels, advancedOn) {

        var selectedVelps = {};
        var selectedLabels = [];

        if (!advancedOn)
            return velps;

        if (labels !== undefined) {
            for (var i = 0; i < labels.length; i++) {
                if (labels[i].selected)
                    selectedLabels.push(labels[i].id);
            }
        }

        if (velps !== undefined) {
            for (var j = 0; j < velps.length; j++) {

                for (var k = 0; k < selectedLabels.length; k++) {
                    if (typeof velps[j].labels !== UNDEFINED && velps[j].labels.indexOf(selectedLabels[k]) !== -1)
                        if (!(j in selectedVelps))
                            selectedVelps[j] = [velps[j], 1];
                        else
                            selectedVelps[j][1] += 1;
                }
            }
        }

        // return all velps if no labels selected
        if (selectedLabels.length === 0)
            return velps;

        var selectedArray = [];
        var returnVelps = [];

        for (var sv in selectedVelps) {
            if (selectedVelps.hasOwnProperty(sv))
                selectedArray.push(selectedVelps[sv]);
        }

        selectedArray.sort(function (a, b) {
            return b[1] - a[1];
        });

        for (var l = 0; l < selectedArray.length; l++)
            returnVelps.push(selectedArray[l][0]);

        return returnVelps;
    };

});

timApp.filter('filterByVelpGroups', function () {
    "use strict";
    return function (velps, groups) {

        var selected = [];
        var checkedGroups = [];

        if (typeof groups === UNDEFINED || typeof velps === UNDEFINED)
            return velps;

        for (var j = 0; j < groups.length; j++)
            if (groups[j].show) checkedGroups.push(groups[j].id);

        for (var i = 0; i < velps.length; i++) {
            // always include velp that is being edited
            if (velps[i].edit){
                selected.push(velps[i]);
                continue;
            }

            for (var k = 0; k < checkedGroups.length; k++) {
                if (velps[i].velp_groups.indexOf(checkedGroups[k]) >= 0 && selected.indexOf(velps[i]) < 0)
                    selected.push(velps[i]);
            }
        }

        return selected;
    };
});