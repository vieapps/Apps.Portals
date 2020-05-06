import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "@services/base.service";
import { PortalsControlsModule } from "@controls/portals.controls.module";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		PortalsControlsModule,
		RouterModule.forChild([
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
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsModule {}
