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
				loadChildren: "@pages/portals/core/portlets/list/list.module#PortalsPortletsListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/portlets/list/list.module#PortalsPortletsListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/portlets/update/update.module#PortalsPortletsUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/portlets/update/update.module#PortalsPortletsUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsPortletsModule {}
