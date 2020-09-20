import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/core/modules/list/list.module#PortalsModulesListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/core/modules/list/list.module#PortalsModulesListPageModule"
	},
	{
		path: "create",
		loadChildren: "@app/pages/portals/core/modules/update/update.module#PortalsModulesUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/core/modules/update/update.module#PortalsModulesUpdatePageModule"
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

export class PortalsModulesModule {}
