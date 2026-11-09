import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/cms/links/list/list.module").then(module => module.CmsLinksListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/cms/links/list/list.module").then(module => module.CmsLinksListPageModule)
	},
	{
		path: "create/:data",
		loadChildren: () => import("@app/pages/portals/cms/links/update/update.module").then(module => module.CmsLinksUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/cms/links/update/update.module").then(module => module.CmsLinksUpdatePageModule)
	},
	{
		path: "view/:data",
		loadChildren: () => import("@app/pages/portals/cms/links/view/view.module").then(module => module.CmsLinksViewPageModule)
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

export class CmsLinksModule {}
