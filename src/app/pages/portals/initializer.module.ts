import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/angular";
import { PortalInitializerPage } from "./initializer.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonContent, IonHeader, IonTitle, IonToolbar,
		RouterModule.forChild([{ path: "", component: PortalInitializerPage }])
	],
	exports: [],
	declarations: [PortalInitializerPage]
})

export class PortalInitializerPageModule {}
