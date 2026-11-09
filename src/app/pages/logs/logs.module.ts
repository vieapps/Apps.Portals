import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticatedGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/logs/services/list/list.module").then(module => module.LogsListPageModule)
	},
	{
		path: "services",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/logs/services/list/list.module").then(module => module.LogsListPageModule)
	},
	{
		path: "services/search",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/logs/services/list/list.module").then(module => module.LogsListPageModule)
	},
	{
		path: "services/view",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/logs/services/view/view.module").then(module => module.LogsViewPageModule)
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class LogsModule {}
