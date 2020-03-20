import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { Ng2CompleterModule } from "ng2-completer";
import { AppFormsService } from "./forms.service";
import { AppFormsComponent } from "./forms.component";
import { AppFormsControlComponent } from "./forms.control.component";

@NgModule({
	providers: [AppFormsService],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		IonicModule,
		Ng2CompleterModule
	],
	exports: [
		AppFormsComponent,
		AppFormsControlComponent
	],
	declarations: [
		AppFormsComponent,
		AppFormsControlComponent
	]
})

export class AppFormsModule {}
