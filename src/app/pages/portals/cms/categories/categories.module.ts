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
				loadChildren: "@pages/portals/cms/categories/list/list.module#CategoriesListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/cms/categories/list/list.module#CategoriesListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/cms/categories/update/update.module#CategoriesUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/cms/categories/update/update.module#CategoriesUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class CategoriesModule {}
