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
				loadChildren: "@pages/portals/core/desktops/list/list.module#PortalsDesktopsListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/desktops/list/list.module#PortalsDesktopsListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/desktops/update/update.module#PortalsDesktopsUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/desktops/update/update.module#PortalsDesktopsUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsDesktopsModule {}
