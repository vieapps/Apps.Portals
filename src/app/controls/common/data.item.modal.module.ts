import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { CommonControlsModule } from "@app/controls/common.controls.module";
import { DataItemModalPage } from "./data.item.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		CommonControlsModule
	],
	exports: [],
	declarations: [DataItemModalPage],
	entryComponents: [DataItemModalPage]
})

export class DataItemModalPageModule {}
