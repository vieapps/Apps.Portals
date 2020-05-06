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
				path: "categories",
				loadChildren: "@pages/portals/cms/categories/categories.module#CategoriesModule"
			},
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCmsModule {}
