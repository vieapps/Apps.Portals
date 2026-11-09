import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonRadio, IonRadioGroup, IonTitle, IonToolbar } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { UsersOtpPage } from "./otp.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		FormsModule,
		IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonRadio, IonRadioGroup, IonTitle, IonToolbar,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: UsersOtpPage }])
	],
	exports: [],
	declarations: [UsersOtpPage]
})

export class UsersOtpPageModule {}
