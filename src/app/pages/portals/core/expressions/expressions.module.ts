import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/expressions/list/list.module").then(module => module.PortalsExpressionsListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/expressions/list/list.module").then(module => module.PortalsExpressionsListPageModule)
	},
	{
		path: "create/:data",
		loadChildren: () => import("@app/pages/portals/core/expressions/update/update.module").then(module => module.PortalsExpressionsUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/expressions/update/update.module").then(module => module.PortalsExpressionsUpdatePageModule)
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

export class PortalsExpressionsModule {}
