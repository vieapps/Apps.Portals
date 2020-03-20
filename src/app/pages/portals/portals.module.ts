import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "../../services/base.service";

import { OrganizationsModule } from "./organizations/organizations.module";

const routes: Routes = [
	/*
	{
		path: "",
		loadChildren: "../home.module#HomePageModule"
	},
	*/
	{
		path: "organizations",
		loadChildren: "./organizations/organizations.module#OrganizationsModule"
	},
	/*
	{
		path: "modules",
		loadChildren: "./modules/modules.module#ModulesModule"
	},
	{
		path: "contenttypes",
		loadChildren: "./contenttypes/contenttypes.module#ContentTypesModule"
	},
	{
		path: "roles",
		loadChildren: "./roles/roles.module#RolesModule"
	},
	{
		path: "expressions",
		loadChildren: "./expressions/expressions.module#ExpressionsModule"
	},
	{
		path: "sites",
		loadChildren: "./sites/sites.module#SitesModule"
	},
	{
		path: "desktops",
		loadChildren: "./desktops/desktops.module#DesktopsModule"
	},
	{
		path: "portlets",
		loadChildren: "./portlets/portlets.module#PortletsModule"
	},
	*/
	{
		path: "**",
		redirectTo: "search",
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

export class PortalsModule {}
