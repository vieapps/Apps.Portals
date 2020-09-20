import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { PortalsRolesListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: PortalsRolesListPage }])
	],
	exports: [],
	declarations: [PortalsRolesListPage]
})

export class PortalsRolesListPageModule {}
