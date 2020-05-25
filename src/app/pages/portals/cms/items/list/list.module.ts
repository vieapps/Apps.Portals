import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@components/time.pipe";
import { CmsItemListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: CmsItemListPage }])
	],
	exports: [],
	declarations: [CmsItemListPage]
})

export class CmsItemsListPageModule {}
