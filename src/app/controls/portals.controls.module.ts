import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { RolesSelectorModule } from "./portals/role.selector.module";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RolesSelectorModule
	],
	exports: [
	],
	declarations: [
	]
})

export class PortalsControlsModule {}
