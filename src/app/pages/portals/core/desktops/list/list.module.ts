import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@components/time.pipe";
import { PortalsDesktopsListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: PortalsDesktopsListPage }])
	],
	exports: [],
	declarations: [PortalsDesktopsListPage]
})

export class PortalsDesktopsListPageModule {}
