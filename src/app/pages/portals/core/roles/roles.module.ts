import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

const routes: Routes = [
	{
		path: "search",
		loadChildren: "../roles/list/list.module#RolesListPageModule"
	},
	{
		path: "list",
		loadChildren: "../roles/list/list.module#RolesListPageModule"
	},
	{
		path: "create",
		loadChildren: "../roles/update/update.module#RolesUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "../roles/update/update.module#RolesUpdatePageModule"
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

export class RolesModule {}
