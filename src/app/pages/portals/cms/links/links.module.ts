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
				loadChildren: "@pages/portals/cms/links/list/list.module#CmsLinksListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/cms/links/list/list.module#CmsLinksListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/cms/links/update/update.module#CmsLinksUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/cms/links/update/update.module#CmsLinksUpdatePageModule"
			},
			{
				path: "view/:data",
				loadChildren: "@pages/portals/cms/links/view/view.module#CmsLinksViewPageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class CmsLinksModule {}
