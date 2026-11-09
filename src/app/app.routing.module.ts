import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AppModulePreloader } from "@app/components/app.preloader";
import { AppReadyGuardService } from "@app/services/base.service";

export const routes: Routes = [
	{
		path: "home",
		data: { preload: true },
		loadChildren: () => import("@app/pages/home.module").then(module => module.HomePageModule)
	},
	{
		path: "metrics",
		data: { preload: true },
		loadChildren: () => import("@app/pages/home.module").then(module => module.HomePageModule)
	},
	{
		path: "search",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/search.module").then(module => module.SearchPageModule)
	},
	{
		path: "users",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/users/users.module").then(module => module.UsersModule)
	},
	{
		path: "logs",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/logs/logs.module").then(module => module.LogsModule)
	},
	{
		path: "notifications",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/notifications/notifications.module").then(module => module.NotificationsModule)
	},
	{
		path: "versions",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/versions/versions.module").then(module => module.VersionsModule)
	},
	{
		path: "trash",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/trash/trash.module").then(module => module.TrashModule)
	},
	{
		path: "portals",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/portals/portals.module").then(module => module.PortalsModule)
	},
	{
		path: "books",
		canActivate: [AppReadyGuardService],
		loadChildren: () => import("@app/pages/books/books.module").then(module => module.BooksModule)
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
