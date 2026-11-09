import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonButtons, IonContent, IonHeader, IonToolbar } from "@ionic/angular";
import { CommonControlsModule } from "@app/controls/common.controls.module";
import { DataItemModalPage } from "./data.item.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonContent, IonHeader, IonToolbar,
		CommonControlsModule
	],
	exports: [],
	declarations: [DataItemModalPage]
})

export class DataItemModalPageModule {}
