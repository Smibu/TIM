import {IController} from "angular";
import {timApp} from "tim/app";
import {showLoginDialog} from "./loginDialog";
import {Users} from "./userService";
import {IUser} from "./IUser";

/**
 * User menu component with a button that displays current user name and the number of additional
 * users logged in the session and opens a dropdown menu with log out and other options.
 */
class UserMenuController implements IController {
    static component = "userMenu";
    static $inject = ["$element", "$scope"] as const;
    private loggingout: boolean;

    constructor() {
        this.loggingout = false;
    }

    isLoggedIn = () => Users.isLoggedIn();

    getCurrentUser = () => Users.getCurrent();
    getSessionUsers = () => Users.getSessionUsers(); // Used in html.

    /**
     * Add another user to the session using login dialog.
     * @param $event
     */
    addUser($event: Event) {
        $event.stopPropagation();
        void showLoginDialog({showSignup: false, addingToSession: true});
    }

    logout = (user: IUser, logoutFromKorppi = false) => Users.logout(user, logoutFromKorppi);

    isKorppi = () => Users.isKorppi(); // Used in html.

    beginLogout($event: Event) {
        if (Users.isKorppi()) {
            this.loggingout = true;
            $event.stopPropagation();
        } else {
            this.logout(this.getCurrentUser());
        }
    }
}

timApp.component("userMenu", {
    bindings: {},
    controller: UserMenuController,
    template: `
     <div class="btn-group margin-4" uib-dropdown on-toggle="$ctrl.toggled(open)">
    <button type="button" title="You're logged in" class="btn btn-primary" uib-dropdown-toggle>
        {{ $ctrl.getCurrentUser().real_name }} <span
            ng-show="$ctrl.getSessionUsers().length > 0">and {{ $ctrl.getSessionUsers().length }} <ng-pluralize
            count="$ctrl.getSessionUsers().length"
            when="{'1': 'other',
                     'other': 'others'}">
        </ng-pluralize></span> <span class="caret"></span>
    </button>
    <ul class="dropdown-menu"
        uib-dropdown-menu
        role="menu"
        aria-labelledby="single-button">
        <li role="menuitem"><a ng-href="/view/{{ $ctrl.getCurrentUser().folder.path }}">My documents</a></li>
        <li role="menuitem"><a
                ng-click="$ctrl.addUser($event)"
                href="#">Add a user to this session...</a></li>
        <li class="divider"></li>
        <li ng-show="!$ctrl.loggingout" role="menuitem">
            <a ng-click="$ctrl.beginLogout($event)" href="#">Log <span
                    ng-show="$ctrl.getSessionUsers().length > 0">everyone</span>
                out<span ng-show="$ctrl.isKorppi()">...</span></a>
        </li>
        <li ng-show="$ctrl.loggingout" role="menuitem">
            <a ng-click="$ctrl.logout($ctrl.getCurrentUser(), true)" href="#">Log out (TIM + Korppi)</a>
        </li>
        <li ng-show="$ctrl.loggingout" role="menuitem">
            <a ng-click="$ctrl.logout($ctrl.getCurrentUser(), false)" href="#">Log out (TIM only)</a>
        </li>
        <li role="menuitem" ng-repeat="u in $ctrl.getSessionUsers()"><a ng-click="$ctrl.logout(u)"
                                                                        href="#">Log {{ u.real_name }} out</a></li>
    </ul>
</div>
    `,
});
