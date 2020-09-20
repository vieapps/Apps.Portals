import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/core/sites/list/list.module#PortalsSitesListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/core/sites/list/list.module#PortalsSitesListPageModule"
	},
	{
		path: "create",
		loadChildren: "@app/pages/portals/core/sites/update/update.module#PortalsSitesUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/core/sites/update/update.module#PortalsSitesUpdatePageModule"
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

export class PortalsSitesModule {}
