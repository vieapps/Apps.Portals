import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/portlets/list/list.module").then(module => module.PortalsPortletsListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/portlets/list/list.module").then(module => module.PortalsPortletsListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/portlets/update/update.module").then(module => module.PortalsPortletsUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/portlets/update/update.module").then(module => module.PortalsPortletsUpdatePageModule)
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

export class PortalsPortletsModule {}
