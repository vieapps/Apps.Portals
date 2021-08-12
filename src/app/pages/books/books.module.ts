import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthenticatedGuardService } from "@app/services/base.service";
import { BookControlsModule } from "@app/controls/books.controls.module";

export const routes: Routes = [
	{
		path: "search",
		data: { preload: true },
		loadChildren: "@app/pages/books/list/list.module#BooksListPageModule"
	},
	{
		path: "category/:data",
		loadChildren: "@app/pages/books/list/list.module#BooksListPageModule"
	},
	{
		path: "author/:data",
		loadChildren: "@app/pages/books/list/list.module#BooksListPageModule"
	},
	{
		path: "options",
		loadChildren: "@app/pages/books/options/options.module#BooksOptionsPageModule"
	},
	{
		path: "info/:data",
		loadChildren: "@app/pages/books/info/info.module#BooksInfoPageModule"
	},
	{
		path: "read/:data",
		data: { preload: true },
		loadChildren: "@app/pages/books/read/read.module#BooksReadPageModule"
	},
	{
		path: "update/:data",
		canActivate: [AuthenticatedGuardService],
		loadChildren: "@app/pages/books/update/update.module#BooksUpdatePageModule"
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		BookControlsModule,
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class BooksModule {}
