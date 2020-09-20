import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { TimePipeModule } from "@app/components/time.pipe";
import { CmsContentListPage } from "./list.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		TimePipeModule,
		RouterModule.forChild([{ path: "", component: CmsContentListPage }])
	],
	exports: [],
	declarations: [CmsContentListPage]
})

export class CmsContentsListPageModule {}
