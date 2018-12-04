﻿import angular from "angular";
import * as t from "io-ts";
import {GenericPluginMarkup, PluginBase, withDefault} from "tim/plugin/util";

const videoApp = angular.module("videoApp", ["ngSanitize"]);

function muunna(value: string | undefined) {
    if (!value) {
        return undefined;
    }
    let s = "0 0 0 " + value.replace(/s/g, "").replace(/[,\/;:.hm]/g, " "); // loppu s unohdetaan muodosta 1h3m2s
    s = s.trim();
    const sc = s.split(" ");
    const n = sc.length;
    const h = parseFloat(sc[n - 3]);
    const m = parseFloat(sc[n - 2]);
    const ss = parseFloat(sc[n - 1]);
    const result = h * 3600.0 + m * 60.0 + ss;
    if (isNaN(result)) {
        return undefined;
    }
    return result;
}

videoApp.component("videoZoom", {
    bindings: {
        c: "<",
    },
    template: `
<p ng-if="$ctrl.c.videoOn" class="pluginShow"><span ng-if="$ctrl.c.video.playbackRate"> Speed:
    <a ng-click="$ctrl.c.speed(1.0/1.2)" title="Slow speed"> - </a>
    <a ng-click="$ctrl.c.speed(0)" title="Speed to 1x"> 1x </a>
    <a ng-click="$ctrl.c.speed(1.2)" title="Faster speed"> + </a> </span>Zoom:
    <a ng-click="$ctrl.c.zoom(1.0/1.4)" title="Zoom out"> - </a>
    <a ng-click="$ctrl.c.zoom(0)" title="Reset to original size"> r </a>
    <a ng-click="$ctrl.c.zoom(1.4)" title="Zoom in"> + </a>
    <a ng-click="$ctrl.c.hideVideo()">{{$ctrl.c.hidetext}}</a>
</p>
`,
});

function time2String(time: number) {
    if (!time) {
        return "";
    }
    const h = Math.floor(time / 3600);
    time = (time - h * 3600);
    const m = Math.floor(time / 60);
    const s = (time - m * 60);
    let hs;
    let ms;
    let ss;
    if (!h) {
        hs = "";
    } else {
        hs = h + "h";
    }
    if (!h && !m) {
        ms = "";
    } else {
        ms = m + "m";
    }
    ss = s + "s";
    return hs + ms + ss;
}

function isYoutube(file: string) {
    if (!file) {
        return false;
    }
    if (file.indexOf("youtube") >= 0) {
        return true;
    }
    return file.indexOf("youtu.be") >= 0;
}

function ifIs(value: number | undefined, name: string) {
    if (!value) {
        return "";
    }
    return name + '="' + value + '" ';
}

const ShowFileMarkup = t.intersection([
    t.partial({
        docicon: t.string,
        doclink: t.string,
        doctext: t.string,
        end: t.string,
        followid: t.string,
        height: t.number,
        hidetext: t.string,
        iframe: t.boolean,
        iframeopts: t.string,
        start: t.string,
        videoicon: t.string,
        videoname: t.string,
        width: t.number,
    }),
    GenericPluginMarkup,
    t.type({
        autoplay: withDefault(t.boolean, true),
        file: t.string,
        open: withDefault(t.boolean, false),
    }),
]);
const ShowFileAll = t.type({markup: ShowFileMarkup});

// TODO: register video to ViewCtrl so that ImageX can access it
class ShowFileController extends PluginBase<t.TypeOf<typeof ShowFileMarkup>,
    t.TypeOf<typeof ShowFileAll>,
    typeof ShowFileAll> {
    private static $inject = ["$scope", "$element"];

    get videoicon() {
        return this.attrs.videoicon || "/csstatic/video_small.png";
    }

    get docicon() {
        return this.attrs.docicon || "/csstatic/book.png";
    }

    get iframe() {
        return this.attrs.iframe || isYoutube(this.attrs.file);
    }

    get videoname() {
        return this.attrs.videoname;
    }

    get doclink() {
        return this.attrs.doclink;
    }

    get hidetext() {
        return this.attrs.hidetext || "hide video";
    }

    get doctext() {
        return this.attrs.doctext;
    }

    private watchEnd?: number;
    private videoHtml!: HTMLElement;
    private start?: number;
    private end?: number;
    private videoOn: boolean = false;
    private span: string = "";
    private origSize!: string;
    private origWidth: any;
    private origHeight: any;
    private video?: HTMLVideoElement;
    private limits: string = "";
    private duration: string = "";
    private startt: string = "";
    private width?: number;
    private height?: number;

    $onInit() {
        super.$onInit();
        this.start = muunna(this.attrs.start);
        this.end = muunna(this.attrs.end);
        this.width = this.attrs.width;
        this.height = this.attrs.height;
        if (this.start && this.end) {
            this.duration = `(${time2String(this.end - this.start)})`;
            this.limits = `(${time2String(this.start)}-${time2String(this.end)})`;
            this.startt = `, ${time2String(this.start)}`;
        }
        this.getPrevZoom();
    }

    $postLink() {
        super.$postLink();
        this.videoHtml = this.element.find(".videoContainer")[0];
        if (this.attrs.open) {
            this.showVideo();
        }
    }

    hideVideo() {
        this.videoOn = false;
        this.videoHtml.innerHTML = "<p></p>";
        this.span = "";
        return true;
    }

    getCurrentZoom() {
        if (localStorage[this.origSize + ".width"]) {
            this.width = localStorage[this.origSize + ".width"];
        }
        if (localStorage[this.origSize + ".height"]) {
            this.height = localStorage[this.origSize + ".height"];
        }
    }

    getPrevZoom() {
        let name = "z";

        if (this.width) {
            name += this.width;
        }
        this.origWidth = this.width;

        name += "x";

        if (this.height) {
            name += this.height;
        }
        this.origHeight = this.height;

        this.origSize = name;
    }

    speed(mult: number) {
        if (!this.video) {
            return;
        }
        if (mult === 0) {
            this.video.playbackRate = 1.0;
        } else {
            this.video.playbackRate *= mult;
        }
    }

    zoom(mult: number) {
        if (mult === 0) {
            this.width = this.origWidth;
            this.height = this.origHeight;
            localStorage.removeItem(this.origSize + ".width");
            localStorage.removeItem(this.origSize + ".height");
        } else {
            if (this.width) {
                this.width *= mult;
                localStorage[this.origSize + ".width"] = "" + this.width;
            }
            if (this.height) {
                this.height *= mult;
                localStorage[this.origSize + ".height"] = "" + this.height;
            }
        }
        this.hideVideo();
        this.showVideo();
    }

    showVideo() {
        if (this.videoOn) {
            return this.hideVideo();
        }
        this.getCurrentZoom();

        this.span = this.limits;
        const w = ifIs(this.width, "width");
        const h = ifIs(this.height, "height");
        const moniviestin = this.attrs.file.indexOf("m3.jyu.fi") >= 0;
        let params = "?";
        if (this.start) {
            if (moniviestin) {
                params = "#position=" + this.start;
            } else {
                params = "?start=" + this.start + "&end=" + this.end;
            }
        }
        if (this.iframe) {
            let file = this.attrs.file;
            if (isYoutube(file) && file.indexOf("embed") < 0) {
                const yname = "youtu.be/";  // could be also https://youtu.be/1OygRiwlAok
                const yembed = "//www.youtube.com/embed/";
                const iy = file.indexOf(yname);
                const parts = file.split("=");
                if (parts.length > 1) {
                    file = yembed + parts[1];
                } else if (iy >= 0) {
                    file = yembed + file.substring(iy + yname.length);
                }
            }
            this.videoHtml.innerHTML = `
<iframe class="showVideo"
        src="${file}${params}"
        ${w}${h}
        frameborder="0"
        allowfullscreen
        ${this.attrs.iframeopts || ""}>
</iframe>`;
        } else {
            params = "";
            if (this.start) {
                params = "#params=" + this.start; // iPad ei tottele 'loadedmetadata'
                if (this.end) {
                    params += "," + this.end;
                }
            }
            let autoplay = "";
            if (this.attrs.autoplay) {
                autoplay = "autoplay";
            }
            this.videoHtml.innerHTML = `
<video class="showVideo"
       src="${this.attrs.file}${params}"
       controls
       ${autoplay}
       ${w}${h}/>`;
            this.video = this.videoHtml.firstElementChild as HTMLVideoElement;
        }
        this.videoOn = true;
        if (!this.video) {
            return;
        }
        this.video.addEventListener("loadedmetadata", () => {
            this.video!.currentTime = this.start || 0;
        }, false);

        this.watchEnd = this.end;
        this.video.addEventListener("timeupdate", () => {
            if (this.watchEnd && this.video!.currentTime > this.watchEnd) {
                this.video!.pause();
                this.watchEnd = 1000000;
            }
        }, false);
    }

    getDefaultMarkup() {
        return {
            file: "https://example.com",
            iframe: true,
        };
    }

    protected getAttributeType() {
        return ShowFileAll;
    }
}

const common = {
    bindings: {
        json: "@",
    },
    controller: ShowFileController,
};

videoApp.component("videoRunner", {
    ...common,
    template: `
<div class="videoRunDiv">
    <p ng-if="$ctrl.header" ng-bind-html="$ctrl.header"></p>
    <p ng-if="$ctrl.stem" class="stem" ng-bind-html="$ctrl.stem"></p>
    <div class="videoContainer"></div>
    <div class="no-popup-menu">
        <img src="/csstatic/video.png"
             ng-if="!$ctrl.videoOn"
             ng-click="$ctrl.showVideo()"
             width="200"
             alt="Click here to show the video"/></div>
    <a href="{{$ctrl.doclink}}" ng-if="$ctrl.doclink" target="timdoc">
        <span ng-if="$ctrl.docicon"><img ng-src="{{$ctrl.docicon}}"
                                    alt="Go to doc"/> </span>{{$ctrl.doctext}}</a>
    <video-zoom c="$ctrl"></video-zoom>
    <p class="plgfooter" ng-if="$ctrl.footer" ng-bind-html="$ctrl.footer"></p>
</div>
`,
});

videoApp.component("smallVideoRunner", {
    ...common,
    template: `
<div class="smallVideoRunDiv">
    <p ng-if="$ctrl.header" ng-bind-html="$ctrl.header"></p>
    <p><span class="stem" ng-bind-html="$ctrl.stem"></span>
        <a ng-if="$ctrl.videoname" class="videoname"
           ng-click="$ctrl.showVideo()"><span ng-if="$ctrl.videoicon">
            <img ng-src="{{$ctrl.videoicon}}" alt="Click here to show"/> </span>
            {{$ctrl.videoname}} {{$ctrl.duration}} {{$ctrl.span}}</a>
        <a href="{{$ctrl.doclink}}" ng-if="$ctrl.doclink" target="timdoc">
            <span ng-if="$ctrl.docicon"><img ng-src="{{$ctrl.docicon}}"
                                             alt="Go to doc"/> </span>{{$ctrl.doctext}}</a>
    </p>
    <div class="videoContainer"></div>
    <video-zoom c="$ctrl"></video-zoom>
    <p class="plgfooter" ng-if="$ctrl.footer" ng-bind-html="$ctrl.footer"></p>
</div>
`,
});

videoApp.component("listVideoRunner", {
    ...common,
    template: `
<div class="listVideoRunDiv">
    <p ng-if="$ctrl.header" ng-bind-html="$ctrl.header"></p>
    <ul>
        <li><span class="stem" ng-bind-html="$ctrl.stem"></span>
            <a ng-if="$ctrl.videoname" class="videoname"
               ng-click="$ctrl.showVideo()">
                <span ng-if="$ctrl.videoicon">
                    <img ng-src="{{$ctrl.videoicon}}" alt="Click here to show"/>
                </span>{{$ctrl.videoname}}{{$ctrl.startt}}
                {{$ctrl.duration}}
                {{$ctrl.span}}</a>
            <a href="{{$ctrl.doclink}}" ng-if="$ctrl.doclink" target="timdoc"><span
                    ng-if="$ctrl.docicon"><img
                    ng-src="{{$ctrl.docicon}}" alt="Go to doc"/> </span>{{$ctrl.doctext}}</a></li>
    </ul>
    <div class="videoContainer"></div>
    <video-zoom c="$ctrl"></video-zoom>
    <p class="plgfooter" ng-if="$ctrl.footer" ng-bind-html="$ctrl.footer"></p>
</div>
`,
});
