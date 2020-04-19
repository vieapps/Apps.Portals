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
				loadChildren: "../organizations/list/list.module#OrganizationsListPageModule"
			},
			{
				path: "list/:data",
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
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class OrganizationsModule {}
