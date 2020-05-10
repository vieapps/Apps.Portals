import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { RolesSelectorModule } from "@controls/portals/role.selector.module";
import { DesktopsSelectorModule } from "@controls/portals/desktop.selector.module";
import { DataLookupModule } from "@controls/portals/data.lookup.module";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RolesSelectorModule,
		DesktopsSelectorModule,
		DataLookupModule
	],
	exports: [
	],
	declarations: [
	]
})

export class PortalsControlsModule {}
