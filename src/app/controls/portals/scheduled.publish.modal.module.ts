import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { ScheduledPublishModalPage } from "./scheduled.publish.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule
	],
	exports: [],
	declarations: [ScheduledPublishModalPage],
	entryComponents: [ScheduledPublishModalPage]
})

export class ScheduledPublishModalPageModule {}
