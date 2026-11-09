import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/content.types/list/list.module").then(module => module.PortalsContentTypesListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/content.types/list/list.module").then(module => module.PortalsContentTypesListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/content.types/update/update.module").then(module => module.PortalsContentTypesUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/content.types/update/update.module").then(module => module.PortalsContentTypesUpdatePageModule)
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

export class PortalsContentTypesModule {}
