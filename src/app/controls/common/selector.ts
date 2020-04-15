import { Component, OnInit, Input } from "@angular/core";
import { AppUtility } from "../../components/app.utility";
import { AppFormsControl, AppFormsService } from "../../components/forms.service";
import { ConfigurationService } from "../../services/configuration.service";

@Component({
	selector: "control-selector",
	templateUrl: "./selector.html",
	styleUrls: ["./selector.scss"]
})

export class SelectorControl implements OnInit {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService
	) {
	}

	/** The form control that contains this control */
	@Input() control: AppFormsControl;

	/** The current items for displying */
	@Input() items: Array<{ Value: string; Label: string; Description?: string; Image?: string }>;

	/** The resources of header, delete confirmation and buttons */
	@Input() resources: { header: string; confirm: string; ok: string; cancel: string; };

	/** true to show image */
	@Input() showImage: boolean;

	/** true to show description */
	@Input() showDescription: boolean;

	/** true to add new items */
	@Input() allowAdd: boolean;

	/** true to delete the selected items */
	@Input() allowDelete: boolean;

	/** The handlers to process the request on add/delete */
	@Input() handlers: { add: () => void; delete: (selected: Array<string>) => void; };

	selected = new Array<string>();

	ngOnInit() {
		this.items = this.items || [];

		this.resources = this.resources || {
			header: undefined,
			confirm: "Are you sure you want to delete?",
			ok: "OK",
			cancel: "Cancel"
		};

		this.showImage = this.showImage !== undefined
			? AppUtility.isTrue(this.showImage)
			: this.control === undefined || this.control.Extras === undefined
				? false
				: this.control.Extras["ShowImage"] !== undefined
					? AppUtility.isTrue(this.control.Extras["ShowImage"])
					: this.control.Extras["showImage"] !== undefined
						? AppUtility.isTrue(this.control.Extras["showImage"])
						: false;

		this.showDescription = this.showDescription !== undefined
			? AppUtility.isTrue(this.showDescription)
			: this.control === undefined || this.control.Extras === undefined
				? false
				: this.control.Extras["ShowDescription"] !== undefined
					? AppUtility.isTrue(this.control.Extras["ShowDescription"])
					: this.control.Extras["showDescription"] !== undefined
						? AppUtility.isTrue(this.control.Extras["showDescription"])
						: false;

		this.allowAdd = this.allowAdd !== undefined
			? AppUtility.isTrue(this.allowAdd)
			: this.control === undefined || this.control.Extras === undefined
				? true
				: this.control.Extras["AllowAdd"] !== undefined
					? AppUtility.isTrue(this.control.Extras["AllowAdd"])
					: this.control.Extras["allowAdd"] !== undefined
						? AppUtility.isTrue(this.control.Extras["allowAdd"])
						: true;

		this.allowDelete = this.allowDelete !== undefined
			? AppUtility.isTrue(this.allowDelete)
			: this.control === undefined || this.control.Extras === undefined
				? true
				: this.control.Extras["AllowDelete"] !== undefined
					? AppUtility.isTrue(this.control.Extras["AllowDelete"])
					: this.control.Extras["allowDelete"] !== undefined
						? AppUtility.isTrue(this.control.Extras["allowDelete"])
						: true;
	}

	track(index: number, item: { Value: string; Label: string; Description: string; Image?: string }) {
		return `${item.Value}@${index}`;
	}

	isChecked(value: string) {
		return this.selected.length > 0 && this.selected.indexOf(value) > -1;
	}

	onChanged(value: string, event: any) {
		if (!event.detail.checked) {
			AppUtility.removeAt(this.selected, this.selected.indexOf(value));
		}
		else if (this.selected.indexOf(value) < 0) {
			this.selected.push(value);
		}
	}

	onAdd() {
		if (this.handlers !== undefined && this.handlers.add !== undefined && typeof this.handlers.add === "function") {
			this.handlers.add();
		}
	}

	onDelete() {
		if (this.handlers !== undefined && this.handlers.delete !== undefined && typeof this.handlers.delete === "function") {
			this.appFormsSvc.showAlertAsync(
				undefined,
				undefined,
				this.resources.confirm,
				() => {
					this.handlers.delete(this.selected);
					this.selected = [];
				},
				this.resources.ok,
				this.resources.cancel
			);
		}
	}

}
