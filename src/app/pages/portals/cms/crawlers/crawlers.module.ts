import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/cms/crawlers/list/list.module").then(module => module.CmsCrawlersListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/cms/crawlers/list/list.module").then(module => module.CmsCrawlersListPageModule)
	},
	{
		path: "create/:data",
		loadChildren: () => import("@app/pages/portals/cms/crawlers/update/update.module").then(module => module.CmsCrawlersUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/cms/crawlers/update/update.module").then(module => module.CmsCrawlersUpdatePageModule)
	},
	{
		path: "view/:data",
		loadChildren: () => import("@app/pages/portals/cms/crawlers/view/view.module").then(module => module.CmsCrawlersViewPageModule)
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

export class CmsCrawlersModule {}
