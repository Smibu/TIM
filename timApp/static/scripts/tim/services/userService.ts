import {$http, $httpParamSerializer, $window} from "../ngimport";
import {IUser} from "../IUser";

export class UserService {
    private current: IUser; // currently logged in user
    private group: IUser[]; // any additional users that have been added in the session - this does not include the main user

    constructor(current: IUser, group: IUser[]) {
        this.current = current;
        this.group = group;
    }

    public getCurrent(): IUser {
        return this.current;
    }

    public getSessionUsers() {
        return this.group;
    }

    public isKorppi(): boolean {
        return this.current.name.indexOf("@") < 0;
    }

    public logout(user: IUser, logoutFromKorppi = false) {
        $http.post<{other_users: IUser[], current_user: IUser}>("/logout", {user_id: user.id}).then((response) => {
            this.group = response.data.other_users;
            this.current = response.data.current_user;
            if (!this.isLoggedIn()) {
                if (logoutFromKorppi) {
                    this.korppiLogout(function() {
                        $window.location.reload();
                    });
                } else {
                    $window.location.reload();
                }
            }
        });
    }

    public isLoggedIn() {
        return this.current.id > 0; // TODO: maybe !== 0
    }

    public korppiLogin(addUser: boolean) {
        const targetUrl = "/korppiLogin";
        const separator = targetUrl.indexOf("?") >= 0 ? "&" : "?";
        const cameFromRaw = $window.came_from || "";
        const cameFrom = encodeURIComponent(cameFromRaw.replace("#", "%23"));
        const anchorRaw = $window.anchor || window.location.hash.replace("#", "");
        const anchor = encodeURIComponent(anchorRaw);
        const redirectFn = function() {
            $window.location.replace(targetUrl + separator + $httpParamSerializer({
                came_from: cameFrom,
                anchor,
                add_user: addUser,
            }));
        };
        if (addUser) {
            this.korppiLogout(redirectFn);
        } else {
            redirectFn();
        }
    }

    public korppiLogout(redirectFn: () => any) {
        $http.get("https://korppi.jyu.fi/kotka/portal/showLogout.jsp",
            {
                withCredentials: true,
                // the request is disallowed with the default custom headers (see base.html), so we disable them
                headers: {
                    "If-Modified-Since": undefined,
                    "Cache-Control": undefined,
                    "Pragma": undefined,
                },
            }).finally(function() {
            $http(
                {
                    withCredentials: true,
                    method: "POST",
                    url: "https://korppi.jyu.fi/openid/manage/manage",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    data: $httpParamSerializer({logout: "Logout"}),
                }).finally(redirectFn);
        });
    }

    public loginWithEmail(email: string, password: string, addUser: boolean, successFn: () => void) {
        $http<{other_users: IUser[], current_user: IUser}>(
            {
                method: "POST",
                url: "/altlogin",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest",
                },
                data: $httpParamSerializer({
                    email,
                    password,
                    add_user: addUser,
                }),
            }).then((response) => {
            this.group = response.data.other_users;
            this.current = response.data.current_user;
            successFn();
            if (!addUser) {
                $window.location.reload();
            }
        }, function(response) {
            $window.alert(response.data.error);
        });
    }
}

export let Users: UserService = null as any;

export function initUserService() {
    if (Users != null) {
        throw new Error("UserService already initialized");
    }
    Users = new UserService($window.current_user, $window.other_users);
}
