import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/cms/crawlers/list/list.module#CmsCrawlersListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/cms/crawlers/list/list.module#CmsCrawlersListPageModule"
	},
	{
		path: "create/:data",
		loadChildren: "@app/pages/portals/cms/crawlers/update/update.module#CmsCrawlersUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/cms/crawlers/update/update.module#CmsCrawlersUpdatePageModule"
	},
	{
		path: "view/:data",
		loadChildren: "@app/pages/portals/cms/crawlers/view/view.module#CmsCrawlersViewPageModule"
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

export class CmsCrawlersModule {}
