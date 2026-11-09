import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonRow, IonTitle, IonToolbar } from "@ionic/angular";
import { QRCodeModule } from "@app/components/qr-code";
import { TimePipeModule } from "@app/components/time.pipe";
import { BooksInfoPage } from "./info.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonRow, IonTitle, IonToolbar,
		QRCodeModule,
		RouterModule.forChild([{ path: "", component: BooksInfoPage }]),
		TimePipeModule
	],
	exports: [],
	declarations: [BooksInfoPage]
})

export class BooksInfoPageModule {}
