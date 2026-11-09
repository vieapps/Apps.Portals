import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonSearchbar, IonThumbnail, IonTitle, IonToolbar } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { CmsItemsListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonSearchbar, IonThumbnail, IonTitle, IonToolbar,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: CmsItemsListPage }])
	],
	exports: [],
	declarations: [CmsItemsListPage]
})

export class CmsItemsListPageModule {}
