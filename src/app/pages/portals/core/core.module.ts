import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "organizations",
		loadChildren: () => import("@app/pages/portals/core/organizations/organizations.module").then(module => module.PortalsOrganizationsModule)
	},
	{
		path: "sites",
		loadChildren: () => import("@app/pages/portals/core/sites/sites.module").then(module => module.PortalsSitesModule)
	},
	{
		path: "roles",
		loadChildren: () => import("@app/pages/portals/core/roles/roles.module").then(module => module.PortalsRolesModule)
	},
	{
		path: "desktops",
		loadChildren: () => import("@app/pages/portals/core/desktops/desktops.module").then(module => module.PortalsDesktopsModule)
	},
	{
		path: "portlets",
		loadChildren: () => import("@app/pages/portals/core/portlets/portlets.module").then(module => module.PortalsPortletsModule)
	},
	{
		path: "modules",
		loadChildren: () => import("@app/pages/portals/core/modules/modules.module").then(module => module.PortalsModulesModule)
	},
	{
		path: "content.types",
		loadChildren: () => import("@app/pages/portals/core/content.types/content.types.module").then(module => module.PortalsContentTypesModule)
	},
	{
		path: "expressions",
		loadChildren: () => import("@app/pages/portals/core/expressions/expressions.module").then(module => module.PortalsExpressionsModule)
	},
	{
		path: "tasks",
		loadChildren: () => import("@app/pages/portals/core/tasks/tasks.module").then(module => module.PortalsTasksModule)
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

export class PortalsCoreModule {}
