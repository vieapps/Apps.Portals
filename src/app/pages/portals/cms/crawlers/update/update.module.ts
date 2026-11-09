import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { DataItemModalPageModule } from "@app/controls/common/data.item.modal.module";
import { CmsCrawlersUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar,
		AppFormsModule,
		DataItemModalPageModule,
		RouterModule.forChild([{ path: "", component: CmsCrawlersUpdatePage }])
	],
	exports: [],
	declarations: [CmsCrawlersUpdatePage]
})

export class CmsCrawlersUpdatePageModule {}
