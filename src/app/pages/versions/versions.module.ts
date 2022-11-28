import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { TimePipeModule } from "@app/components/time.pipe";
import { VersionsPage } from "./versions.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "**", component: VersionsPage }])
	],
	exports: [],
	declarations: [VersionsPage]
})

export class VersionsModule {}
