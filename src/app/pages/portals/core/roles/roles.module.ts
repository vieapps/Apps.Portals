import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/core/roles/list/list.module#PortalsRolesListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/core/roles/list/list.module#PortalsRolesListPageModule"
	},
	{
		path: "create",
		loadChildren: "@app/pages/portals/core/roles/update/update.module#PortalsRolesUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/core/roles/update/update.module#PortalsRolesUpdatePageModule"
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

export class PortalsRolesModule {}
