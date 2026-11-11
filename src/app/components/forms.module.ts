import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NgSelectModule } from "@ng-select/ng-select";
import { IonDatetime, IonRange, IonButton, IonButtons, IonCheckbox, IonChip, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonRadio, IonRadioGroup, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonTextarea, IonThumbnail, IonToggle } from "@ionic/angular";
import { AppFormsService } from "./forms.service";
import { AppFormsComponent } from "./forms.component";
import { AppFormsControlComponent } from "./forms.control.component";
import { AppFormsViewComponent } from "./forms.view.component";
import { CommonControlsModule } from "@app/controls/common.controls.module";
import { AppCompleterControl } from "./app.completer.control";
import { CKEditorControl } from "./ckeditor.control";
import { addIcons } from "ionicons";
import { add, close, closeCircle, eye, eyeOff, refresh, trash } from "ionicons/icons";

// Ionic's installed icon set: register the fixed names used by these templates.
addIcons({ add, close, closeCircle, eye, eyeOff, refresh, trash });

@NgModule({
	providers: [AppFormsService],
	imports: [CommonModule, ReactiveFormsModule, FormsModule, NgSelectModule, CommonControlsModule, IonDatetime, IonRange, IonButton, IonButtons, IonCheckbox, IonChip, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonRadio, IonRadioGroup, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonTextarea, IonThumbnail, IonToggle],
	declarations: [AppCompleterControl, CKEditorControl, AppFormsComponent, AppFormsControlComponent, AppFormsViewComponent],
	exports: [AppFormsComponent, AppFormsControlComponent, AppFormsViewComponent]
})
export class AppFormsModule {}
