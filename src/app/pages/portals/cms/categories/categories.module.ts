import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/cms/categories/list/list.module").then(module => module.CmsCategoriesListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/cms/categories/list/list.module").then(module => module.CmsCategoriesListPageModule)
	},
	{
		path: "create/:data",
		loadChildren: () => import("@app/pages/portals/cms/categories/update/update.module").then(module => module.CmsCategoriesUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/cms/categories/update/update.module").then(module => module.CmsCategoriesUpdatePageModule)
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

export class CmsCategoriesModule {}
