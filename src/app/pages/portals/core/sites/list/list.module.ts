import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonMenuButton, IonSearchbar, IonTitle, IonToolbar } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { PortalsSitesListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonMenuButton, IonSearchbar, IonTitle, IonToolbar,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: PortalsSitesListPage }])
	],
	exports: [],
	declarations: [PortalsSitesListPage]
})

export class PortalsSitesListPageModule {}
