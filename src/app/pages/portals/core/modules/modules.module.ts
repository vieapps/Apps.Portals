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
				loadChildren: "@pages/portals/core/modules/list/list.module#ModulesListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/modules/list/list.module#ModulesListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/modules/update/update.module#ModulesUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/modules/update/update.module#ModulesUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class ModulesModule {}
