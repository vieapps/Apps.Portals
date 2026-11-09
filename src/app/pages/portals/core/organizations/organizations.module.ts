import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/organizations/list/list.module").then(module => module.PortalsOrganizationsListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/organizations/list/list.module").then(module => module.PortalsOrganizationsListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/organizations/update/update.module").then(module => module.PortalsOrganizationsUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/organizations/update/update.module").then(module => module.PortalsOrganizationsUpdatePageModule)
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

export class PortalsOrganizationsModule {}
