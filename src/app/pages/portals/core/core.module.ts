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
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCoreModule {}
