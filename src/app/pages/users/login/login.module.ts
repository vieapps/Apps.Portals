import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonButton, IonIcon } from "@ionic/angular";
import { addIcons } from "ionicons";
import { close, key, chatboxEllipses, personOutline } from "ionicons/icons";

addIcons({ close, key, chatboxEllipses, personOutline });
import { AppFormsModule } from "@app/components/forms.module";
import { UsersLogInPage } from "./login.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonButton, IonIcon,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: UsersLogInPage }])
	],
	exports: [],
	declarations: [UsersLogInPage]
})

export class UsersLogInPageModule {}
