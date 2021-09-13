import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/cms/forms/list/list.module#CmsFormsListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/cms/forms/list/list.module#CmsFormsListPageModule"
	},
	{
		path: "create/:data",
		loadChildren: "@app/pages/portals/cms/forms/update/update.module#CmsFormsUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/cms/forms/update/update.module#CmsFormsUpdatePageModule"
	},
	{
		path: "view/:data",
		loadChildren: "@app/pages/portals/cms/forms/view/view.module#CmsFormsViewPageModule"
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

export class CmsFormsModule {}
