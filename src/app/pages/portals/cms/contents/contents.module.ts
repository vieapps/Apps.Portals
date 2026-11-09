import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/cms/contents/list/list.module").then(module => module.CmsContentsListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/cms/contents/list/list.module").then(module => module.CmsContentsListPageModule)
	},
	{
		path: "create/:data",
		loadChildren: () => import("@app/pages/portals/cms/contents/update/update.module").then(module => module.CmsContentsUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/cms/contents/update/update.module").then(module => module.CmsContentsUpdatePageModule)
	},
	{
		path: "view/:data",
		loadChildren: () => import("@app/pages/portals/cms/contents/view/view.module").then(module => module.CmsContentsViewPageModule)
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

export class CmsContentsModule {}
