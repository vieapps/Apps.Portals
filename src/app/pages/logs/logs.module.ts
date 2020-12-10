import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/logs/list/list.module#LogsListPageModule"
	},
	{
		path: "search",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/logs/list/list.module#LogsListPageModule"
	},
	{
		path: "view",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/logs/view/view.module#LogsViewPageModule"
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class LogsModule {}
