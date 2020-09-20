import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "organizations",
		loadChildren: "@app/pages/portals/core/organizations/organizations.module#PortalsOrganizationsModule"
	},
	{
		path: "sites",
		loadChildren: "@app/pages/portals/core/sites/sites.module#PortalsSitesModule"
	},
	{
		path: "roles",
		loadChildren: "@app/pages/portals/core/roles/roles.module#PortalsRolesModule"
	},
	{
		path: "desktops",
		loadChildren: "@app/pages/portals/core/desktops/desktops.module#PortalsDesktopsModule"
	},
	{
		path: "portlets",
		loadChildren: "@app/pages/portals/core/portlets/portlets.module#PortalsPortletsModule"
	},
	{
		path: "modules",
		loadChildren: "@app/pages/portals/core/modules/modules.module#PortalsModulesModule"
	},
	{
		path: "content.types",
		loadChildren: "@app/pages/portals/core/content.types/content.types.module#PortalsContentTypesModule"
	},
	{
		path: "expressions",
		loadChildren: "@app/pages/portals/core/expressions/expressions.module#PortalsExpressionsModule"
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

export class PortalsCoreModule {}
