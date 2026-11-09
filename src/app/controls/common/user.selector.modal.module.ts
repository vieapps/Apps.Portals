import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonThumbnail, IonTitle, IonToolbar } from "@ionic/angular";
import { UsersSelectorModalPage } from "./user.selector.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonThumbnail, IonTitle, IonToolbar
	],
	exports: [],
	declarations: [UsersSelectorModalPage]
})

export class UsersSelectorModalPageModule {}
