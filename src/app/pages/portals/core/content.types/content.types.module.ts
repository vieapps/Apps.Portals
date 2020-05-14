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
				loadChildren: "@pages/portals/core/content.types/list/list.module#PortalsContentTypesListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/content.types/list/list.module#PortalsContentTypesListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/content.types/update/update.module#PortalsContentTypesUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/content.types/update/update.module#PortalsContentTypesUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsContentTypesModule {}
