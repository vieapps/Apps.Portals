import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { RegisterGuardService, AuthenticatedGuardService, NotAuthenticatedGuardService } from "../../services/base.service";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild([
			{
				path: "login",
				data: { preload: true },
				canActivate: [NotAuthenticatedGuardService],
				loadChildren: "./login/login.module#UsersLogInPageModule"
			},
			{
				path: "register",
				data: { preload: true },
				canActivate: [RegisterGuardService, NotAuthenticatedGuardService],
				loadChildren: "./register/register.module#UsersRegisterPageModule"
			},
			{
				path: "profile/:data",
				data: { preload: true },
				canActivate: [AuthenticatedGuardService],
				loadChildren: "./profile/profile.module#UsersProfilePageModule"
			},
			{
				path: "update/:data",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "./update/update.module#UsersUpdatePageModule"
			},
			{
				path: "otp",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "./otp/otp.module#UsersOtpPageModule"
			},
			{
				path: "list",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "./list/list.module#UsersListPageModule"
			},
			{
				path: "search",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "./list/list.module#UsersListPageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class UsersModule {}
