import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { Ng2CompleterModule } from "ng2-completer";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { AppFormsService } from "@app/components/forms.service";
import { AppFormsComponent } from "@app/components/forms.component";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { AppFormsViewComponent } from "@app/components/forms.view.component";
import { CommonControlsModule } from "@app/controls/common.controls.module";

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
		AppFormsControlComponent,
		AppFormsViewComponent
	],
	declarations: [
		AppFormsComponent,
		AppFormsControlComponent,
		AppFormsViewComponent
	]
})

export class AppFormsModule {}
