import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { HashSet } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsControl, AppFormsLookupValue } from "@app/components/forms.objects";
import { ConfigurationService } from "@app/services/configuration.service";

@Component({
	selector: "control-data-selector",
	templateUrl: "./data.selector.control.html",
	styleUrls: ["./data.selector.control.scss"]
})

export class DataSelectorControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService
	) {
	}

	/** The form control that contains this control */
	@Input() private control: AppFormsControl;

	/** The current items for displying */
	@Input() items: Array<AppFormsLookupValue>;

	/** The settings (allow add/delete, show show item's image/description, position of desscription) */
	@Input() private settings: { [key: string]: any };

	/** Set to 'true' to allow select multiple item */
	@Input() private multiple: boolean;

	/** The event handler to run when the controls was initialized */
	@Output() init = new EventEmitter<DataSelectorControl>();

	private _showImage: boolean;
	private _showDescription: boolean;
	private _descriptionAtRight: boolean;
	private _selected = new HashSet<string>();

	get color() {
		return this.configSvc.color;
	}

	get showImage() {
		return this._showImage;
	}

	get showDescription() {
		return this._showDescription;
	}

	get descriptionAtRight() {
		return this._descriptionAtRight;
	}

	ngOnInit() {
		this.items = this.items || [];

		this.settings = AppUtility.isObject(this.settings, true)
			? this.settings
			: this.control !== undefined && this.control.Extras !== undefined
				? this.control.Extras["Settings"] || this.control.Extras["settings"] || {}
				: {};

		this.multiple = this.multiple !== undefined
			? AppUtility.isTrue(this.multiple)
			: this.settings.multiple !== undefined ? AppUtility.isTrue(this.settings.multiple) : true;

		this._selected = new HashSet<string>(AppUtility.isObject(this.settings.selected, true) && this.settings.selected instanceof Set ? this.settings.selected.values() : new Array<string>());

		this._showImage = this.settings.ShowImage !== undefined || this.settings.showImage !== undefined
			? !!(this.settings.ShowImage || this.settings.showImage)
			: false;

		this._showDescription = this.settings.ShowDescription !== undefined || this.settings.showDescription !== undefined
			? !!(this.settings.ShowDescription || this.settings.showDescription)
			: false;

		this._descriptionAtRight = this.settings.DescriptionAtRight !== undefined || this.settings.descriptionAtRight !== undefined
			? !!(this.settings.DescriptionAtRight || this.settings.descriptionAtRight)
			: false;

		this.init.emit(this);
	}

	ngOnDestroy() {
		this.init.unsubscribe();
	}

	track(index: number, item: AppFormsLookupValue) {
		return `${item.Value}@${index}`;
	}

	checked(value: string) {
		return this._selected.contains(value);
	}

	select(event: any, value: string) {
		if (event.detail.checked) {
			if (!this.multiple) {
				this._selected.clear();
			}
			this._selected.add(value);
		}
		else {
			this._selected.remove(value);
		}
		if (typeof this.settings.onSelect === "function") {
			this.settings.onSelect(value, event.detail.checked);
		}
	}

}
