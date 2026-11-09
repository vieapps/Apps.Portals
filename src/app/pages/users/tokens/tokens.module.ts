import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticatedGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "create",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/tokens/create/create.module").then(module => module.TokensCreatePageModule)
	},
	{
		path: "view/:data",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/tokens/view/view.module").then(module => module.TokensViewPageModule)
	},
	{
		path: "list",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/tokens/list/list.module").then(module => module.TokensListPageModule)
	},
	{
		path: "search",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/tokens/list/list.module").then(module => module.TokensListPageModule)
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

export class TokensModule {}
