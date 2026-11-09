import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { ScheduledPublishModalPage } from "./scheduled.publish.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar,
		AppFormsModule
	],
	exports: [],
	declarations: [ScheduledPublishModalPage]
})

export class ScheduledPublishModalPageModule {}
