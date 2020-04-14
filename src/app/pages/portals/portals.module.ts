import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "../../services/base.service";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild([
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
			// }
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsModule {}
