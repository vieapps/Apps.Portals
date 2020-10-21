import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { DataLookupModalPageModule } from "@app/controls/portals/data.lookup.modal.module";
import { DesktopsSelectorModalPageModule } from "@app/controls/portals/desktop.selector.modal.module";
import { RolesSelectorModalPageModule } from "@app/controls/portals/role.selector.modal.module";
import { FeaturedContentsControl } from "@app/controls/portals/featured.contents.control";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		DataLookupModalPageModule,
		DesktopsSelectorModalPageModule,
		RolesSelectorModalPageModule
	],
	exports: [
		FeaturedContentsControl
	],
	declarations: [
		FeaturedContentsControl
	]
})

export class PortalsControlsModule {}
