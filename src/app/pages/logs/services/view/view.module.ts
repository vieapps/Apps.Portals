import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { TimePipeModule } from "@app/components/time.pipe";
import { LogsViewPage } from "./view.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar,
		AppFormsModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: LogsViewPage }])
	],
	exports: [],
	declarations: [LogsViewPage]
})

export class LogsViewPageModule {}
