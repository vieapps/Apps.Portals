import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@pages/portals/cms/items/list/list.module#CmsItemsListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@pages/portals/cms/items/list/list.module#CmsItemsListPageModule"
	},
	{
		path: "create",
		loadChildren: "@pages/portals/cms/items/update/update.module#CmsItemsUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@pages/portals/cms/items/update/update.module#CmsItemsUpdatePageModule"
	},
	{
		path: "view/:data",
		loadChildren: "@pages/portals/cms/items/view/view.module#CmsItemsViewPageModule"
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

export class CmsItemsModule {}
