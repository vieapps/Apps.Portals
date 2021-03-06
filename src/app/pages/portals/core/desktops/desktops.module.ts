import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/core/desktops/list/list.module#PortalsDesktopsListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/core/desktops/list/list.module#PortalsDesktopsListPageModule"
	},
	{
		path: "create",
		loadChildren: "@app/pages/portals/core/desktops/update/update.module#PortalsDesktopsUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/core/desktops/update/update.module#PortalsDesktopsUpdatePageModule"
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

export class PortalsDesktopsModule {}
