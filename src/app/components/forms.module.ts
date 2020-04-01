import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { Ng2CompleterModule } from "ng2-completer";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { AppFormsService } from "./forms.service";
import { AppFormsComponent } from "./forms.component";
import { AppFormsControlComponent } from "./forms.control.component";
import { CommonControlsModule } from "../controls/common.controls.module";

@NgModule({
	providers: [AppFormsService],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		IonicModule,
		CKEditorModule,
		Ng2CompleterModule,
		CommonControlsModule
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
