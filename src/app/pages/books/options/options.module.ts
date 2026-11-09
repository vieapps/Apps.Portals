import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { BooksOptionsPage } from "./options.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: BooksOptionsPage }])
	],
	exports: [],
	declarations: [BooksOptionsPage]
})

export class BooksOptionsPageModule {}
