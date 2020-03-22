import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "../../services/base.service";

import { OrganizationsModule } from "./core/organizations/organizations.module";

const routes: Routes = [
	/*
	{
		path: "",
		loadChildren: "../home.module#HomePageModule"
	},
	*/
	{
		path: "organizations",
		loadChildren: "./core/organizations/organizations.module#OrganizationsModule"
	},
	/*
	{
		path: "modules",
		loadChildren: "./core/modules/modules.module#ModulesModule"
	},
	{
		path: "contenttypes",
		loadChildren: "./core/contenttypes/contenttypes.module#ContentTypesModule"
	},
	{
		path: "roles",
		loadChildren: "./core/roles/roles.module#RolesModule"
	},
	{
		path: "expressions",
		loadChildren: "./core/expressions/expressions.module#ExpressionsModule"
	},
	{
		path: "sites",
		loadChildren: "./core/sites/sites.module#SitesModule"
	},
	{
		path: "desktops",
		loadChildren: "./core/desktops/desktops.module#DesktopsModule"
	},
	{
		path: "portlets",
		loadChildren: "./core/portlets/portlets.module#PortletsModule"
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
