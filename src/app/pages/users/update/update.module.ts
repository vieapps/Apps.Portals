import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { CommonControlsModule } from "@app/controls/common.controls.module";
import { UsersUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
		AppFormsModule,
		CommonControlsModule,
		RouterModule.forChild([{ path: "", component: UsersUpdatePage }])
	],
	exports: [],
	declarations: [UsersUpdatePage]
})

export class UsersUpdatePageModule {}
