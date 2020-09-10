import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "@services/base.service";
import { PortalsControlsModule } from "@controls/portals.controls.module";

export const routes: Routes = [
	{
		path: "initializer",
		data: { preload: true },
		loadChildren: "@pages/portals/initializer.module#PortalInitializerPageModule"
	},
	{
		path: "core",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@pages/portals/core/core.module#PortalsCoreModule"
	},
	{
		path: "cms",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@pages/portals/cms/cms.module#PortalsCmsModule"
	},
	// {
	// 	path: "search",
	// 	canActivate: [AuthenticatedGuardService],
	// 	loadChildren: "@pages/portals/search/search.module#PortalsSearchModule"
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
