import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "categories",
		loadChildren: "@app/pages/portals/cms/categories/categories.module#CmsCategoriesModule"
	},
	{
		path: "contents",
		loadChildren: "@app/pages/portals/cms/contents/contents.module#CmsContentsModule"
	},
	{
		path: "items",
		loadChildren: "@app/pages/portals/cms/items/items.module#CmsItemsModule"
	},
	{
		path: "links",
		loadChildren: "@app/pages/portals/cms/links/links.module#CmsLinksModule"
	},
	{
		path: "forms",
		loadChildren: "@app/pages/portals/cms/forms/forms.module#CmsFormsModule"
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

export class PortalsCmsModule {}
