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
		loadChildren: "./core/organizations/organizations.module#OrganizationsModule"
	},
	/*
	{
		path: "core/modules",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/modules/modules.module#ModulesModule"
	},
	{
		path: "core/contenttypes",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/contenttypes/contenttypes.module#ContentTypesModule"
	},
	{
		path: "core/roles",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/roles/roles.module#RolesModule"
	},
	{
		path: "core/expressions",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/expressions/expressions.module#ExpressionsModule"
	},
	{
		path: "core/sites",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/sites/sites.module#SitesModule"
	},
	{
		path: "core/desktops",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/desktops/desktops.module#DesktopsModule"
	},
	{
		path: "core/portlets",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/portlets/portlets.module#PortletsModule"
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
