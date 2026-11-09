import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/cms/forms/list/list.module").then(module => module.CmsFormsListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/cms/forms/list/list.module").then(module => module.CmsFormsListPageModule)
	},
	{
		path: "create/:data",
		loadChildren: () => import("@app/pages/portals/cms/forms/update/update.module").then(module => module.CmsFormsUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/cms/forms/update/update.module").then(module => module.CmsFormsUpdatePageModule)
	},
	{
		path: "view/:data",
		loadChildren: () => import("@app/pages/portals/cms/forms/view/view.module").then(module => module.CmsFormsViewPageModule)
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

export class CmsFormsModule {}
