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
				loadChildren: "./list/list.module#RolesListPageModule"
			},
			{
				path: "list",
				loadChildren: "./list/list.module#RolesListPageModule"
			},
			{
				path: "create",
				loadChildren: "./update/update.module#RolesUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "./update/update.module#RolesUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class RolesModule {}
