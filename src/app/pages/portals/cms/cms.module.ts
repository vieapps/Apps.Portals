import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "categories",
		loadChildren: () => import("@app/pages/portals/cms/categories/categories.module").then(module => module.CmsCategoriesModule)
	},
	{
		path: "contents",
		loadChildren: () => import("@app/pages/portals/cms/contents/contents.module").then(module => module.CmsContentsModule)
	},
	{
		path: "items",
		loadChildren: () => import("@app/pages/portals/cms/items/items.module").then(module => module.CmsItemsModule)
	},
	{
		path: "links",
		loadChildren: () => import("@app/pages/portals/cms/links/links.module").then(module => module.CmsLinksModule)
	},
	{
		path: "forms",
		loadChildren: () => import("@app/pages/portals/cms/forms/forms.module").then(module => module.CmsFormsModule)
	},
	{
		path: "crawlers",
		loadChildren: () => import("@app/pages/portals/cms/crawlers/crawlers.module").then(module => module.CmsCrawlersModule)
	}
];

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		
		RouterModule.forChild(routes)
	],
	exports: [RouterModule],
	declarations: []
})

export class PortalsCmsModule {}
