import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { CmsCrawlersViewPage } from "./view.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: CmsCrawlersViewPage }])
	],
	exports: [],
	declarations: [CmsCrawlersViewPage]
})

export class CmsCrawlersViewPageModule {}
