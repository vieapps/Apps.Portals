import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AppModulePreloader } from "@components/app.preloader";
import { AppReadyGuardService } from "@services/base.service";

export const routes: Routes = [
	{
		path: "home",
		data: { preload: true },
		loadChildren: "@pages/home.module#HomePageModule"
	},
	{
		path: "users",
		canActivate: [AppReadyGuardService],
		loadChildren: "@pages/users/users.module#UsersModule"
	},
	{
		path: "portals",
		canActivate: [AppReadyGuardService],
		loadChildren: "@pages/portals/portals.module#PortalsModule"
	},
	{
		path: "**",
		redirectTo: "/home",
		pathMatch: "full"
	}
];

@NgModule({
	imports: [
		RouterModule.forRoot(routes, { preloadingStrategy: AppModulePreloader })
	],
	exports: [RouterModule]
})

export class AppRoutingModule {}
