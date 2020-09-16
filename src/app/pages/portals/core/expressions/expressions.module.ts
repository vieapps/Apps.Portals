import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@pages/portals/core/expressions/list/list.module#PortalsExpressionsListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@pages/portals/core/expressions/list/list.module#PortalsExpressionsListPageModule"
	},
	{
		path: "create/:data",
		loadChildren: "@pages/portals/core/expressions/update/update.module#PortalsExpressionsUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@pages/portals/core/expressions/update/update.module#PortalsExpressionsUpdatePageModule"
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

export class PortalsExpressionsModule {}
