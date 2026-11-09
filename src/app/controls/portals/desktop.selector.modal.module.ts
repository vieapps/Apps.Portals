import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonTitle, IonToolbar } from "@ionic/angular";
import { DesktopsSelectorModalPage } from "./desktop.selector.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonTitle, IonToolbar
	],
	exports: [],
	declarations: [DesktopsSelectorModalPage]
})

export class DesktopsSelectorModalPageModule {}
