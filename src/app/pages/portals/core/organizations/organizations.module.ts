import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild([
			{
				path: "search",
				loadChildren: "@pages/portals/core/organizations/list/list.module#PortalsOrganizationsListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/organizations/list/list.module#PortalsOrganizationsListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/organizations/update/update.module#PortalsOrganizationsUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/organizations/update/update.module#PortalsOrganizationsUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsOrganizationsModule {}
