import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { PortalInitializerPage } from "./initializer.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild([{ path: "", component: PortalInitializerPage }])
	],
	exports: [],
	declarations: [PortalInitializerPage]
})

export class PortalInitializerPageModule {}
