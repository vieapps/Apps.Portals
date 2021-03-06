import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { RegisterGuardService, AuthenticatedGuardService, NotAuthenticatedGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "login",
		data: { preload: true },
		canActivate: [NotAuthenticatedGuardService],
		loadChildren: "@app/pages/users/login/login.module#UsersLogInPageModule"
	},
	{
		path: "register",
		data: { preload: true },
		canActivate: [RegisterGuardService, NotAuthenticatedGuardService],
		loadChildren: "@app/pages/users/register/register.module#UsersRegisterPageModule"
	},
	{
		path: "profile/:data",
		data: { preload: true },
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/profile/profile.module#UsersProfilePageModule"
	},
	{
		path: "update/:data",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/update/update.module#UsersUpdatePageModule"
	},
	{
		path: "otp",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/otp/otp.module#UsersOtpPageModule"
	},
	{
		path: "list",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/list/list.module#UsersListPageModule"
	},
	{
		path: "search",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/users/list/list.module#UsersListPageModule"
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

export class UsersModule {}
