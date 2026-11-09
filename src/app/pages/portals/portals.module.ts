import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticatedGuardService } from "@app/services/base.service";
import { PortalsControlsModule } from "@app/controls/portals.controls.module";

export const routes: Routes = [
	{
		path: "initializer",
		data: { preload: true },
		loadChildren: () => import("@app/pages/portals/initializer.module").then(module => module.PortalInitializerPageModule)
	},
	{
		path: "core",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/portals/core/core.module").then(module => module.PortalsCoreModule)
	},
	{
		path: "cms",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/portals/cms/cms.module").then(module => module.PortalsCmsModule)
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		
		PortalsControlsModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsModule {}
