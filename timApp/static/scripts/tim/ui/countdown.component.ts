import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import humanizeDuration from "humanize-duration";
import {formatString, secondsToHHMMSS, to2} from "tim/util/utils";
import {Users} from "tim/user/userService";
import moment from "moment";
import {HttpClient} from "@angular/common/http";

const DAY_LIMIT = 24 * 60 * 60;

@Component({
    selector: "tim-countdown",
    template: `
        {{formatString(template, timeLeft)}}
    `,
})
export class CountdownComponent implements OnInit {
    @Input() endTime?: string;
    @Input() seconds?: number;
    @Input() displayUnits: humanizeDuration.Unit[] = [];
    @Input() noAutoStart: boolean = false;
    @Input() template: string = "{0}";
    @Input() lowTimeThreshold: number = -1;
    @Output() onFinish: EventEmitter<void> = new EventEmitter<void>();
    @Output() onLowTime: EventEmitter<void> = new EventEmitter<void>();

    isLowTime = false;
    currentCountdown = 0;
    currentEndDate?: moment.Moment;
    locale = Users.getCurrentLanguage();
    currentInterval?: number;
    formatString = formatString;

    constructor(private http: HttpClient) {
    }

    get timeLeft() {
        let prefix = "";
        let time = Math.max(this.currentCountdown, 0);
        if (this.currentCountdown > DAY_LIMIT && this.displayUnits.length != 0) {
            prefix = humanizeDuration(this.currentCountdown * 1000, {units: this.displayUnits, round: true, language: this.locale}) + " + ";
            time %= DAY_LIMIT;
        }
        return `${prefix}${secondsToHHMMSS(time)}`;
    }

    private async getEndDate() {
        // Ceil countdown seconds so we always include possible fractions of a second and account for possible
        // floating point precision errors
        if (this.seconds) {
            return moment().add(Math.ceil(this.seconds), "seconds");
        }
        if (this.endTime) {
            const serverTime = await to2(this.http.get<{time: moment.Moment}>("/time").toPromise());
            if (!serverTime.ok) {
                return moment();
            }
            return moment().add(Math.ceil(moment(this.endTime).diff(serverTime.result.time, "seconds", true)), "seconds");
        }
        return moment();
    }

    ngOnInit() {
        if (this.noAutoStart) { return; }
        this.start();
    }

    async start() {
        if (this.currentInterval) { return; }
        this.currentEndDate = await this.getEndDate();
        if (this.checkCountdown()) { return; }
        this.currentInterval = window.setInterval(() => this.checkCountdown(), 1000);
    }

    stop() {
        if (!this.currentInterval) { return; }
        window.clearInterval(this.currentInterval);
    }

    reset() {
        this.currentInterval = undefined;
        this.isLowTime = false;
    }

    private checkCountdown() {
        this.currentCountdown = this.currentEndDate?.diff(moment(), "s") ?? 0;
        const timeEnded = this.currentCountdown <= 0;
        if (!this.isLowTime && this.currentCountdown < this.lowTimeThreshold) {
            this.onLowTime.emit();
            this.isLowTime = true;
        }
        if (timeEnded) {
            this.onFinish.emit();
            this.stop();
        }
        return timeEnded;
    }
}
