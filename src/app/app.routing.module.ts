import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AppModulePreloader } from "./components/app.preloader";
import { AppReadyGuardService } from "./services/base.service";
import { AppConfig } from "./app.config";

@NgModule({
	imports: [
		RouterModule.forRoot([
			{
				path: AppConfig.url.home.substr(1),
				data: { preload: true },
				loadChildren: "./pages/home.module#HomePageModule"
			},
			{
				path: "users",
				canActivate: [AppReadyGuardService],
				loadChildren: "./pages/users/users.module#UsersModule"
			},
			{
				path: "portals",
				canActivate: [AppReadyGuardService],
				loadChildren: "./pages/portals/portals.module#PortalsModule"
			},
			{
				path: "**",
				redirectTo: AppConfig.url.home,
				pathMatch: "full"
			}
		], { preloadingStrategy: AppModulePreloader })
	],
	exports: [RouterModule]
})

export class AppRoutingModule {}
