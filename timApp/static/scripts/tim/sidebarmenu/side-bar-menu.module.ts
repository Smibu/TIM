import {NgModule} from "@angular/core";
import {CommonModule} from "@angular/common";
import {TabsModule} from "ngx-bootstrap/tabs";
import {TooltipModule} from "ngx-bootstrap/tooltip";
import {SidebarMenuComponent} from "tim/sidebarmenu/sidebar-menu.component";
import {TabEntryListService} from "tim/sidebarmenu/tab-entry-list.service";
import {BookmarksTabComponent} from "./tabs/bookmarks-tab.component";
import {MenuTabDirective} from "./menu-tab.directive";
import {TabContainerComponent} from "./tab-container.component";

@NgModule({
    providers: [
        TabEntryListService,
    ],
    declarations: [
        SidebarMenuComponent,
        BookmarksTabComponent,
        MenuTabDirective,
        TabContainerComponent,
    ],
    imports: [
        CommonModule,
        TabsModule.forRoot(),
        TooltipModule.forRoot(),
    ],
    entryComponents: [
        BookmarksTabComponent,
    ],
})
export class SideBarMenuModule {
}
