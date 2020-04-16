import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { RolesSelectorModalPage } from "./role.selector.modal.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [],
	declarations: [RolesSelectorModalPage],
	entryComponents: [RolesSelectorModalPage]
})

export class RolesSelectorModule {}
