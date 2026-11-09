import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { PortalsModulesUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: PortalsModulesUpdatePage }])
	],
	exports: [],
	declarations: [PortalsModulesUpdatePage]
})

export class PortalsModulesUpdatePageModule {}
