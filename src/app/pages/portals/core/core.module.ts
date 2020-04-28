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
				loadChildren: "@pages/portals/core/organizations/organizations.module#OrganizationsModule"
			},
			{
				path: "roles",
				loadChildren: "@pages/portals/core/roles/roles.module#RolesModule"
			},
			{
				path: "desktops",
				loadChildren: "@pages/portals/core/desktops/desktops.module#DesktopsModule"
			},
			{
				path: "sites",
				loadChildren: "@pages/portals/core/sites/sites.module#SitesModule"
			},
			{
				path: "modules",
				loadChildren: "@pages/portals/core/modules/modules.module#ModulesModule"
			},
			{
				path: "content.types",
				loadChildren: "@pages/portals/core/content.types/content.types.module#ContentTypesModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCoreModule {}
