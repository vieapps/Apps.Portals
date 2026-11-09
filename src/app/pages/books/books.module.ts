import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticatedGuardService } from "@app/services/base.service";
import { BookControlsModule } from "@app/controls/books.controls.module";

export const routes: Routes = [
	{
		path: "search",
		data: { preload: true },
		loadChildren: () => import("@app/pages/books/list/list.module").then(module => module.BooksListPageModule)
	},
	{
		path: "category/:data",
		loadChildren: () => import("@app/pages/books/list/list.module").then(module => module.BooksListPageModule)
	},
	{
		path: "author/:data",
		loadChildren: () => import("@app/pages/books/list/list.module").then(module => module.BooksListPageModule)
	},
	{
		path: "options",
		loadChildren: () => import("@app/pages/books/options/options.module").then(module => module.BooksOptionsPageModule)
	},
	{
		path: "info/:data",
		loadChildren: () => import("@app/pages/books/info/info.module").then(module => module.BooksInfoPageModule)
	},
	{
		path: "read/:data",
		data: { preload: true },
		loadChildren: () => import("@app/pages/books/read/read.module").then(module => module.BooksReadPageModule)
	},
	{
		path: "update/:data",
		canActivate: [AuthenticatedGuardService],
		loadChildren: () => import("@app/pages/books/update/update.module").then(module => module.BooksUpdatePageModule)
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		
		BookControlsModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class BooksModule {}
