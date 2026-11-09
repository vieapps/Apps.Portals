import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonSpinner, IonTitle, IonToolbar } from "@ionic/angular";
import { DataLookupModalPage } from "./data.lookup.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonSpinner, IonTitle, IonToolbar
	],
	exports: [],
	declarations: [DataLookupModalPage]
})

export class DataLookupModalPageModule {}
