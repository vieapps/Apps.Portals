import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { RegisterGuardService, AuthenticatedGuardService, NotAuthenticatedGuardService } from "@services/base.service";

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
				loadChildren: "@pages/users/login/login.module#UsersLogInPageModule"
			},
			{
				path: "register",
				data: { preload: true },
				canActivate: [RegisterGuardService, NotAuthenticatedGuardService],
				loadChildren: "@pages/users/register/register.module#UsersRegisterPageModule"
			},
			{
				path: "profile/:data",
				data: { preload: true },
				canActivate: [AuthenticatedGuardService],
				loadChildren: "@pages/users/profile/profile.module#UsersProfilePageModule"
			},
			{
				path: "update/:data",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "@pages/users/update/update.module#UsersUpdatePageModule"
			},
			{
				path: "otp",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "@pages/users/otp/otp.module#UsersOtpPageModule"
			},
			{
				path: "list",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "@pages/users/list/list.module#UsersListPageModule"
			},
			{
				path: "search",
				canActivate: [AuthenticatedGuardService],
				loadChildren: "@pages/users/list/list.module#UsersListPageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class UsersModule {}
