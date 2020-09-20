import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/core/organizations/list/list.module#PortalsOrganizationsListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/core/organizations/list/list.module#PortalsOrganizationsListPageModule"
	},
	{
		path: "create",
		loadChildren: "@app/pages/portals/core/organizations/update/update.module#PortalsOrganizationsUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/core/organizations/update/update.module#PortalsOrganizationsUpdatePageModule"
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsOrganizationsModule {}
