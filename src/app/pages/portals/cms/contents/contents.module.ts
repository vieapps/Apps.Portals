import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@pages/portals/cms/contents/list/list.module#CmsContentsListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@pages/portals/cms/contents/list/list.module#CmsContentsListPageModule"
	},
	{
		path: "create",
		loadChildren: "@pages/portals/cms/contents/update/update.module#CmsContentsUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@pages/portals/cms/contents/update/update.module#CmsContentsUpdatePageModule"
	},
	{
		path: "view/:data",
		loadChildren: "@pages/portals/cms/contents/view/view.module#CmsContentsViewPageModule"
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

export class CmsContentsModule {}
