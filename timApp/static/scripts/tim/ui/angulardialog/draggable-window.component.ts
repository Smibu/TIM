import {Component, Input} from "@angular/core";
import {AngularDialogComponent} from "tim/ui/angulardialog/angular-dialog-component.directive";

@Component({
    selector: "tim-detachable-window",
    template: `
    <tim-dialog-frame [detachable]="true">
        <ng-container header>{{title}}</ng-container>
        <ng-container body>
            <ng-content></ng-content>
        </ng-container>
    </tim-dialog-frame>
  `,
    styleUrls: ["./draggable-window.component.scss"],
})
export class DetachableWindowComponent extends AngularDialogComponent<
    undefined,
    undefined
> {
    @Input() protected dialogName!: string;
    @Input() title!: string;

    ngOnInit(): void {}
}
