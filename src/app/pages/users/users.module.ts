import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";

import { RegisterGuardService, AuthenticatedGuardService, NotAuthenticatedGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "login",
		data: { preload: true },
		canActivate: [NotAuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/login/login.module").then(module => module.UsersLogInPageModule)
	},
	{
		path: "register",
		data: { preload: true },
		canActivate: [RegisterGuardService, NotAuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/register/register.module").then(module => module.UsersRegisterPageModule)
	},
	{
		path: "profile/:data",
		data: { preload: true },
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/profile/profile.module").then(module => module.UsersProfilePageModule)
	},
	{
		path: "update/:data",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/update/update.module").then(module => module.UsersUpdatePageModule)
	},
	{
		path: "otp",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/otp/otp.module").then(module => module.UsersOtpPageModule)
	},
	{
		path: "list",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/list/list.module").then(module => module.UsersListPageModule)
	},
	{
		path: "search",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/list/list.module").then(module => module.UsersListPageModule)
	},
	{
		path: "tokens",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/users/tokens/tokens.module").then(module => module.TokensModule)
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

export class UsersModule {}
