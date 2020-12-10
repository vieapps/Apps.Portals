import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AppModulePreloader } from "@app/components/app.preloader";
import { AppReadyGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "home",
		data: { preload: true },
		loadChildren: "@app/pages/home.module#HomePageModule"
	},
	{
		path: "users",
		canActivate: [AppReadyGuardService],
		loadChildren: "@app/pages/users/users.module#UsersModule"
	},
	{
		path: "logs",
		canActivate: [AppReadyGuardService],
		loadChildren: "@app/pages/logs/logs.module#LogsModule"
	},
	{
		path: "portals",
		canActivate: [AppReadyGuardService],
		loadChildren: "@app/pages/portals/portals.module#PortalsModule"
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
