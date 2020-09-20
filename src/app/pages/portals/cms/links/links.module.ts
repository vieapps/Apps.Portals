import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/cms/links/list/list.module#CmsLinksListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/cms/links/list/list.module#CmsLinksListPageModule"
	},
	{
		path: "create/:data",
		loadChildren: "@app/pages/portals/cms/links/update/update.module#CmsLinksUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/cms/links/update/update.module#CmsLinksUpdatePageModule"
	},
	{
		path: "view/:data",
		loadChildren: "@app/pages/portals/cms/links/view/view.module#CmsLinksViewPageModule"
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

export class CmsLinksModule {}
