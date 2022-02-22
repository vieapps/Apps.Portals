import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { HashSet } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsControl, AppFormsLookupValue } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";

@Component({
	selector: "control-data-item",
	templateUrl: "./data.item.control.html",
	styleUrls: ["./data.item.control.scss"]
})

export class DataItemControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService
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
	@Output() init = new EventEmitter<DataItemControl>();

	private _showImage: boolean;
	private _showDescription: boolean;
	private _descriptionAtRight: boolean;

	private _allowAdd: boolean;
	private _allowDelete: boolean;
	private _allowSelect: boolean;
	private _allowClick: boolean;
	private _icon: string;
	private _selected = new HashSet<string>();

	get color() {
		return this.configSvc.color;
	}

	get resources(): { [key: string]: any } {
		return this.settings ? this.settings.resources || {} : {};
	}

	get disabled() {
		return this.control && this.control.Options.Disabled
			? true
			: undefined;
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

	get allowAdd() {
		return this._allowAdd;
	}

	get allowDelete() {
		return this._allowDelete;
	}

	get allowSelect() {
		return this._allowSelect;
	}

	get allowClick() {
		return this._allowClick;
	}

	get icon() {
		return this._icon || "create";
	}

	ngOnInit() {
		this.items = this.items || [];

		this.settings = AppUtility.isObject(this.settings, true)
			? this.settings
			: this.control !== undefined && this.control.Extras !== undefined
				? this.control.Extras["Settings"] || this.control.Extras["settings"] || {}
				: {};

		this._allowAdd = this.settings.allowAdd !== undefined ? AppUtility.isTrue(this.settings.allowAdd) : true;
		this._allowDelete = this.settings.allowDelete !== undefined ? AppUtility.isTrue(this.settings.allowDelete) : true;
		this._allowSelect = this.settings.allowSelect !== undefined ? AppUtility.isTrue(this.settings.allowSelect) : true;
		this._allowClick = this.settings.allowClick !== undefined ? AppUtility.isTrue(this.settings.allowClick) : false;
		this._icon = this.settings.icon;
		this._selected = new HashSet<string>(AppUtility.isObject(this.settings.selected, true) && this.settings.selected instanceof Set ? this.settings.selected.values() : new Array<string>());

		this.multiple = this.multiple !== undefined
			? AppUtility.isTrue(this.multiple)
			: this.settings.multiple !== undefined ? AppUtility.isTrue(this.settings.multiple) : true;

		this._showImage = this.settings.ShowImage !== undefined || this.settings.showImage !== undefined
			? !!(this.settings.ShowImage || this.settings.showImage)
			: false;

		this._showDescription = this.settings.ShowDescription !== undefined || this.settings.showDescription !== undefined
			? !!(this.settings.ShowDescription || this.settings.showDescription)
			: false;

		this._descriptionAtRight = this.settings.DescriptionAtRight !== undefined || this.settings.descriptionAtRight !== undefined
			? !!(this.settings.DescriptionAtRight || this.settings.descriptionAtRight)
			: false;

		this.control.Options.Disabled = true;
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

	add(event: Event) {
		event.stopPropagation();
		if (!!this.settings.handlers && typeof this.settings.handlers.onAdd === "function") {
			this.settings.handlers.onAdd();
		}
	}

	delete(event: Event) {
		event.stopPropagation();
		if (!!this.settings.handlers && typeof this.settings.handlers.onDelete === "function") {
			this.appFormsSvc.showAlertAsync(
				undefined,
				undefined,
				this.resources.confirm,
				() => {
					this.settings.handlers.onDelete(this._selected.toArray());
					this._selected.clear();
				},
				this.resources.ok,
				this.resources.cancel
			);
		}
	}

	select(event: any, value: string) {
		event.stopPropagation();
		if (event.detail.checked) {
			if (!this.multiple) {
				this._selected.clear();
			}
			this._selected.add(value);
		}
		else {
			this._selected.remove(value);
		}
		if (!!this.settings.handlers && typeof this.settings.handlers.onSelect === "function") {
			this.settings.handlers.onSelect(value, event.detail.checked);
		}
		this.control.Options.Disabled = this._selected.size < 1;
	}

	click(event: Event, value: string) {
		event.stopPropagation();
		if (!!this.settings.handlers && typeof this.settings.handlers.onClick === "function") {
			this.settings.handlers.onClick(event, value);
		}
	}

}
