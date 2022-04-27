import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { IonicModule } from "@ionic/angular";

export const routes: Routes = [
	{
		path: "search",
		loadChildren: "@app/pages/portals/core/tasks/list/list.module#PortalsTasksListPageModule"
	},
	{
		path: "list/:data",
		loadChildren: "@app/pages/portals/core/tasks/list/list.module#PortalsTasksListPageModule"
	},
	{
		path: "create",
		loadChildren: "@app/pages/portals/core/tasks/update/update.module#PortalsTasksUpdatePageModule"
	},
	{
		path: "update/:data",
		loadChildren: "@app/pages/portals/core/tasks/update/update.module#PortalsTasksUpdatePageModule"
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

export class PortalsTasksModule {}
