import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/sites/list/list.module").then(module => module.PortalsSitesListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/sites/list/list.module").then(module => module.PortalsSitesListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/sites/update/update.module").then(module => module.PortalsSitesUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/sites/update/update.module").then(module => module.PortalsSitesUpdatePageModule)
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

export class PortalsSitesModule {}
