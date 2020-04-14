import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

const routes: Routes = [
	{
		path: "search",
		loadChildren: "../organizations/list/list.module#OrganizationsListPageModule"
	},
	{
		path: "list",
		loadChildren: "../organizations/list/list.module#OrganizationsListPageModule"
	},
	{
		path: "create",
		loadChildren: "../organizations/update/update.module#OrganizationsUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "../organizations/update/update.module#OrganizationsUpdatePageModule"
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

export class OrganizationsModule {}
