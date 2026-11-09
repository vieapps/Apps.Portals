import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonCol, IonContent, IonFooter, IonGrid, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonList, IonMenuButton, IonRow, IonSearchbar, IonTitle, IonToolbar } from "@ionic/angular";
import { BookControlsModule } from "@app/controls/books.controls.module";
import { BooksListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonCol, IonContent, IonFooter, IonGrid, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonList, IonMenuButton, IonRow, IonSearchbar, IonTitle, IonToolbar,
		BookControlsModule,
		RouterModule.forChild([{ path: "", component: BooksListPage }])
	],
	exports: [],
	declarations: [BooksListPage]
})

export class BooksListPageModule {}
