import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
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

export class PortalsPortletsModule {}
