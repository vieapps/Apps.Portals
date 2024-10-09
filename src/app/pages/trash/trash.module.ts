import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { TimePipeModule } from "@app/components/time.pipe";
import { TrashPage } from "./trash.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "**", component: TrashPage }])
	],
	exports: [],
	declarations: [TrashPage]
})

export class TrashModule {}
