import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@pages/portals/cms/categories/list/list.module#CmsCategoriesListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@pages/portals/cms/categories/list/list.module#CmsCategoriesListPageModule"
	},
	{
		path: "create",
		loadChildren: "@pages/portals/cms/categories/update/update.module#CmsCategoriesUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@pages/portals/cms/categories/update/update.module#CmsCategoriesUpdatePageModule"
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

export class CmsCategoriesModule {}
