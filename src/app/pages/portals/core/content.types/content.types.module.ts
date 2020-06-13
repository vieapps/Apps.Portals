import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
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

export class PortalsContentTypesModule {}
