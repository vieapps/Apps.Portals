import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "../../../services/base.service";

import { OrganizationsListPageModule } from "./list/list.module";
import { OrganizationsUpdatePageModule } from "./update/update.module";

const routes: Routes = [
	{
		path: "organizations/search",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "../organizations/list/list.module#OrganizationsListPageModule"
	},
	{
		path: "organizations/list",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "../organizations/list/list.module#OrganizationsListPageModule"
	},
	{
		path: "organizations/create",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "../organizations/update/update.module#OrganizationsUpdatePageModule"
	},
	{
		path: "organizations/update/:data",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "../organizations/update/update.module#OrganizationsUpdatePageModule"
	},
	/*
	{
		path: "view/:data",
		data: { preload: true },
		canActivate: [AuthenticatedGuardService],
		loadChildren: "../organizations/read/read.module#OrganizationsViewPageModule"
	},
	*/
	{
		path: "**",
		redirectTo: "organizations/search",
		pathMatch: "full"
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		OrganizationsListPageModule,
		OrganizationsUpdatePageModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class OrganizationsModule {}
