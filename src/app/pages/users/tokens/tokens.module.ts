import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "create",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/tokens/create/create.module#TokensCreatePageModule"
	},
	{
		path: "view/:data",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/tokens/view/view.module#TokensViewPageModule"
	},
	{
		path: "list",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/tokens/list/list.module#TokensListPageModule"
	},
	{
		path: "search",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/tokens/list/list.module#TokensListPageModule"
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

export class TokensModule {}
