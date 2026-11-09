import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonTitle, IonToolbar } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { LogsListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonTitle, IonToolbar,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: LogsListPage }])
	],
	exports: [],
	declarations: [LogsListPage]
})

export class LogsListPageModule {}
