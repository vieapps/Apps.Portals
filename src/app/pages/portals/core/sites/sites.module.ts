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
				loadChildren: "@pages/portals/core/sites/list/list.module#PortalsSitesListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/sites/list/list.module#PortalsSitesListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/sites/update/update.module#PortalsSitesUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/sites/update/update.module#PortalsSitesUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsSitesModule {}
