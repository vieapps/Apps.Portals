import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "../../../services/base.service";

import { OrganizationsModule } from "./organizations/organizations.module";

const routes: Routes = [
	{
		path: "core/organizations",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./organizations/organizations.module#OrganizationsModule"
	},
	/*
	{
		path: "core/modules",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./modules/modules.module#ModulesModule"
	},
	{
		path: "core/contenttypes",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./contenttypes/contenttypes.module#ContentTypesModule"
	},
	{
		path: "core/roles",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./roles/roles.module#RolesModule"
	},
	{
		path: "core/expressions",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./expressions/expressions.module#ExpressionsModule"
	},
	{
		path: "core/sites",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./sites/sites.module#SitesModule"
	},
	{
		path: "core/desktops",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./desktops/desktops.module#DesktopsModule"
	},
	{
		path: "core/portlets",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./portlets/portlets.module#PortletsModule"
	},
	*/
	{
		path: "**",
		redirectTo: "/home",
		pathMatch: "full"
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		OrganizationsModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCoreModule {}
