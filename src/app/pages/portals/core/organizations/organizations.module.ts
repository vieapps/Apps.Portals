import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild([
			{
				path: "search",
				loadChildren: "./list/list.module#OrganizationsListPageModule"
			},
			{
				path: "list",
				loadChildren: "./list/list.module#OrganizationsListPageModule"
			},
			{
				path: "create",
				loadChildren: "./update/update.module#OrganizationsUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "./update/update.module#OrganizationsUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class OrganizationsModule {}
