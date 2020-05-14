import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@components/time.pipe";
import { PortalsModulesListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: PortalsModulesListPage }])
	],
	exports: [],
	declarations: [PortalsModulesListPage]
})

export class PortalsModulesListPageModule {}
