import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { RolesSelectorModalPageModule } from "@controls/portals/role.selector.modal.module";
import { DesktopsSelectorModalPageModule } from "@controls/portals/desktop.selector.modal.module";
import { DataLookupModalPageModule } from "@controls/portals/data.lookup.modal.module";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RolesSelectorModalPageModule,
		DesktopsSelectorModalPageModule,
		DataLookupModalPageModule
	],
	exports: [
	],
	declarations: [
	]
})

export class PortalsControlsModule {}
