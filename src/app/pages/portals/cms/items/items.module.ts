import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/cms/items/list/list.module").then(module => module.CmsItemsListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/cms/items/list/list.module").then(module => module.CmsItemsListPageModule)
	},
	{
		path: "create/:data",
		loadChildren: () => import("@app/pages/portals/cms/items/update/update.module").then(module => module.CmsItemsUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/cms/items/update/update.module").then(module => module.CmsItemsUpdatePageModule)
	},
	{
		path: "view/:data",
		loadChildren: () => import("@app/pages/portals/cms/items/view/view.module").then(module => module.CmsItemsViewPageModule)
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class CmsItemsModule {}
