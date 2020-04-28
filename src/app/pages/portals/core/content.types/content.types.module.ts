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
				loadChildren: "@pages/portals/core/content.types/list/list.module#ContentTypesListPageModule"
			},
			{
				path: "list/:data",
				loadChildren: "@pages/portals/core/content.types/list/list.module#ContentTypesListPageModule"
			},
			{
				path: "create",
				loadChildren: "@pages/portals/core/content.types/update/update.module#ContentTypesUpdatePageModule"
			},
			{
				path: "update/:data",
				loadChildren: "@pages/portals/core/content.types/update/update.module#ContentTypesUpdatePageModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class ContentTypesModule {}
