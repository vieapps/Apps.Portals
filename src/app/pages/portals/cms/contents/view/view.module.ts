import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { CmsContentsViewPage } from "./view.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: CmsContentsViewPage }])
	],
	exports: [],
	declarations: [CmsContentsViewPage]
})

export class CmsContentsViewPageModule {}
