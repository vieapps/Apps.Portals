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
				loadChildren: "./organizations/organizations.module#OrganizationsModule"
			},
			{
				path: "roles",
				loadChildren: "./roles/roles.module#RolesModule"
			},
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCoreModule {}
