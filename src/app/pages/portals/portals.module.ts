import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "@app/services/base.service";
import { PortalsControlsModule } from "@app/controls/portals.controls.module";

export const routes: Routes = [
	{
		path: "initializer",
		data: { preload: true },
		loadChildren: "@app/pages/portals/initializer.module#PortalInitializerPageModule"
	},
	{
		path: "core",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/portals/core/core.module#PortalsCoreModule"
	},
	{
		path: "cms",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/portals/cms/cms.module#PortalsCmsModule"
	},
	// {
	// 	path: "search",
	// 	canActivate: [AuthenticatedGuardService],
	// 	loadChildren: "@app/pages/portals/search/search.module#PortalsSearchModule"
	// }
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		PortalsControlsModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsModule {}
