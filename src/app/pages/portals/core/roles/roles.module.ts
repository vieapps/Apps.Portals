import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/roles/list/list.module").then(module => module.PortalsRolesListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/roles/list/list.module").then(module => module.PortalsRolesListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/roles/update/update.module").then(module => module.PortalsRolesUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/roles/update/update.module").then(module => module.PortalsRolesUpdatePageModule)
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

export class PortalsRolesModule {}
