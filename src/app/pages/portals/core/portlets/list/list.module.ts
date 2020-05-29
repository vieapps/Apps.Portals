import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@components/time.pipe";
import { PortalsPortletsListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: PortalsPortletsListPage }])
	],
	exports: [],
	declarations: [PortalsPortletsListPage]
})

export class PortalsPortletsListPageModule {}
