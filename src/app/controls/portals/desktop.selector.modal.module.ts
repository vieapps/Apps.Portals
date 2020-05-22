import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { DesktopsSelectorModalPage } from "./desktop.selector.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [],
	declarations: [DesktopsSelectorModalPage],
	entryComponents: [DesktopsSelectorModalPage]
})

export class DesktopsSelectorModalPageModule {}
