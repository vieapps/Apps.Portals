import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule } from "@angular/forms";
import { IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonTextarea, IonToggle, IonToolbar } from "@ionic/angular";
import { FilesProcessorModalPage } from "./file.processor.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonTextarea, IonToggle, IonToolbar
	],
	exports: [],
	declarations: [FilesProcessorModalPage]
})

export class FilesProcessorModalPageModule {}
