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
				loadChildren: "@pages/portals/core/sites/list/list.module#SitesListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/sites/list/list.module#SitesListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/sites/update/update.module#SitesUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/sites/update/update.module#SitesUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class SitesModule {}
