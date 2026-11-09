import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonSelect, IonSelectOption, IonThumbnail, IonToolbar } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { SearchPage } from "@app/pages/search.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonSearchbar, IonSelect, IonSelectOption, IonThumbnail, IonToolbar,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: SearchPage }])
	],
	exports: [],
	declarations: [SearchPage]
})

export class SearchPageModule {}
