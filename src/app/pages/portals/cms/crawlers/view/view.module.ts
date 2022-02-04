import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { CmsCrawlersViewPage } from "./view.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: CmsCrawlersViewPage }])
	],
	exports: [],
	declarations: [CmsCrawlersViewPage]
})

export class CmsCrawlersViewPageModule {}
