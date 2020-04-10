import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "../../services/base.service";

import { PortalsCoreModule } from "./core/core.module";
// import { PortalsCmsModule } from "./cms/cms.module";
// import { PortalsSearchModule } from "./search/search.module";

const routes: Routes = [
	{
		path: "core",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "./core/core.module#PortalsCoreModule"
	},
	// {
	// 	path: "cms",
	// 	canActivate: [AuthenticatedGuardService],
	// 	loadChildren: "./cms/cms.module#PortalsCmsModule"
	// },
	// {
	// 	path: "search",
	// 	canActivate: [AuthenticatedGuardService],
	// 	loadChildren: "./search/search.module#PortalsSearchModule"
	// },
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
		PortalsCoreModule,
		// PortalsCmsModule,
		// PortalsSearchModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsModule {}
