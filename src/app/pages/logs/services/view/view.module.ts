import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { TimePipeModule } from "@app/components/time.pipe";
import { LogsViewPage } from "./view.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: LogsViewPage }])
	],
	exports: [],
	declarations: [LogsViewPage]
})

export class LogsViewPageModule {}
