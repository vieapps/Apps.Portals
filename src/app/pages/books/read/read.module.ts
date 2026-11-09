import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from "@ionic/angular";
import { BooksReadPage } from "./read.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar,
		RouterModule.forChild([{ path: "", component: BooksReadPage }])
	],
	exports: [],
	declarations: [BooksReadPage]
})

export class BooksReadPageModule {}
