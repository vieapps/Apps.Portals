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
				loadChildren: "@pages/portals/cms/categories/categories.module#CmsCategoriesModule"
			},
			{
				path: "contents",
				loadChildren: "@pages/portals/cms/contents/contents.module#CmsContentsModule"
			}
		])
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCmsModule {}
