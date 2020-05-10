import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { DataLookupModalPage } from "./data.lookup.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [],
	declarations: [DataLookupModalPage],
	entryComponents: [DataLookupModalPage]
})

export class DataLookupModule {}
