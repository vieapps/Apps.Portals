import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/desktops/list/list.module").then(module => module.PortalsDesktopsListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/desktops/list/list.module").then(module => module.PortalsDesktopsListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/desktops/update/update.module").then(module => module.PortalsDesktopsUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/desktops/update/update.module").then(module => module.PortalsDesktopsUpdatePageModule)
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

export class PortalsDesktopsModule {}
