import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { PortalsOrganizationsListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: PortalsOrganizationsListPage }])
	],
	exports: [],
	declarations: [PortalsOrganizationsListPage]
})

export class PortalsOrganizationsListPageModule {}
