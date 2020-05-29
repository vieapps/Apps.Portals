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
				path: "organizations",
				loadChildren: "@pages/portals/core/organizations/organizations.module#PortalsOrganizationsModule"
			},
			{
				path: "sites",
				loadChildren: "@pages/portals/core/sites/sites.module#PortalsSitesModule"
			},
			{
				path: "roles",
				loadChildren: "@pages/portals/core/roles/roles.module#PortalsRolesModule"
			},
			{
				path: "desktops",
				loadChildren: "@pages/portals/core/desktops/desktops.module#PortalsDesktopsModule"
			},
			{
				path: "modules",
				loadChildren: "@pages/portals/core/modules/modules.module#PortalsModulesModule"
			},
			{
				path: "content.types",
				loadChildren: "@pages/portals/core/content.types/content.types.module#PortalsContentTypesModule"
			},
			{
				path: "expressions",
				loadChildren: "@pages/portals/core/expressions/expressions.module#PortalsExpressionsModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCoreModule {}
