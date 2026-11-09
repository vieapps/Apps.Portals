import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { CmsLinksViewPage } from "./view.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: CmsLinksViewPage }])
	],
	exports: [],
	declarations: [CmsLinksViewPage]
})

export class CmsLinksViewPageModule {}
