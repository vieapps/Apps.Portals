import { Component, OnInit, Input } from "@angular/core";
import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsLookupValue } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";

@Component({
	selector: "page-data-item",
	templateUrl: "./data.item.modal.page.html",
	styleUrls: ["./data.item.modal.page.scss"]
})

export class DataItemModalPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService
	) {
	}

	/** The current items for displying */
	@Input() items: Array<AppFormsLookupValue>;

	/** The resources of buttons */
	@Input() resources: { select?: string; cancel?: string; };

	/** The settings (allow add/delete, show show item's image/description, position of desscription) */
	@Input() settings: { [key: string]: any };

	/** Set to 'true' to allow select multiple item */
	@Input() multiple: boolean;

	labels = {
		select: "Select",
		cancel: "Cancel"
	};

	selected = new Dictionary<string, AppFormsLookupValue>();

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.items = this.items || [];
		this.resources = AppUtility.isObject(this.resources, true) ? this.resources : {};
		this.settings = AppUtility.isObject(this.settings, true) ? this.settings : {};
		this.multiple = this.multiple !== undefined
			? AppUtility.isTrue(this.multiple)
			: this.settings.multiple !== undefined ? AppUtility.isTrue(this.settings.multiple) : true;
		this.settings.onSelect = (value: string, checked: boolean) => this.onSelect(value, checked);
		AppUtility.invoke(async () => this.labels = {
			select: this.resources.select || await this.appFormsSvc.getResourceAsync("common.buttons.select"),
			cancel: this.resources.cancel || await this.appFormsSvc.getResourceAsync("common.buttons.cancel")
		});
	}

	private onSelect(value: string, checked: boolean) {
		if (checked) {
			if (!this.multiple) {
				this.selected.clear();
			}
			this.selected.add(value, this.items.first(item => item.Value === value));
		}
		else {
			this.selected.remove(value);
		}
	}

	closeAsync(items?: Array<AppFormsLookupValue>) {
		return items === undefined || items.length > 0 ? this.appFormsSvc.hideModalAsync(items) : AppUtility.promise;
	}

}
