import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonContent, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonList, IonSearchbar, IonThumbnail, IonTitle, IonToolbar } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { CmsCrawlersListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonContent, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonList, IonSearchbar, IonThumbnail, IonTitle, IonToolbar,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: CmsCrawlersListPage }])
	],
	exports: [],
	declarations: [CmsCrawlersListPage]
})

export class CmsCrawlersListPageModule {}
