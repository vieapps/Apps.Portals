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
				loadChildren: "@pages/portals/core/expressions/list/list.module#PortalsExpressionsListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/expressions/list/list.module#PortalsExpressionsListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/expressions/update/update.module#PortalsExpressionsUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/expressions/update/update.module#PortalsExpressionsUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsExpressionsModule {}
