import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";


export const routes: Routes = [
	{
		path: "search",
		loadChildren: () => import("@app/pages/portals/core/tasks/list/list.module").then(module => module.PortalsTasksListPageModule)
	},
	{
		path: "list/:data",
		loadChildren: () => import("@app/pages/portals/core/tasks/list/list.module").then(module => module.PortalsTasksListPageModule)
	},
	{
		path: "create",
		loadChildren: () => import("@app/pages/portals/core/tasks/update/update.module").then(module => module.PortalsTasksUpdatePageModule)
	},
	{
		path: "update/:data",
		loadChildren: () => import("@app/pages/portals/core/tasks/update/update.module").then(module => module.PortalsTasksUpdatePageModule)
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

export class PortalsTasksModule {}
