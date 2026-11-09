import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonRadio, IonRadioGroup, IonTitle, IonToolbar } from "@ionic/angular";
import { CommonControlsModule } from "@app/controls/common.controls.module";
import { UsersAvatarPage } from "./avatar.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonRadio, IonRadioGroup, IonTitle, IonToolbar,
		CommonControlsModule
	],
	exports: [],
	declarations: [UsersAvatarPage]
})

export class UsersAvatarPageModule {}
