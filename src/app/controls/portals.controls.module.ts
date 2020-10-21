import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { RolesSelectorModalPageModule } from "@app/controls/portals/role.selector.modal.module";
import { DesktopsSelectorModalPageModule } from "@app/controls/portals/desktop.selector.modal.module";
import { DataLookupModalPageModule } from "@app/controls/portals/data.lookup.modal.module";

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
