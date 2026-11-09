import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/modules/list/list.module").then(module => module.PortalsModulesListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/modules/list/list.module").then(module => module.PortalsModulesListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/modules/update/update.module").then(module => module.PortalsModulesUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/modules/update/update.module").then(module => module.PortalsModulesUpdatePageModule)
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

export class PortalsModulesModule {}
