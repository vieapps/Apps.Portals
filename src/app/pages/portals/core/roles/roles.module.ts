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
				loadChildren: "../roles/list/list.module#RolesListPageModule"
			},
			{
				path: "list/:data",
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
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class RolesModule {}
