import { Component, OnInit, Input } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppUtility } from "@components/app.utility";
import { AppFormsControl } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AttachmentInfo } from "@models/base";

@Component({
	selector: "control-file-selector",
	templateUrl: "./file.selector.control.html",
	styleUrls: ["./file.selector.control.scss"]
})

export class FilesSelectorControl implements OnInit {

	constructor(
		public configSvc: ConfigurationService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	/** The form control that contains this control */
	@Input() private control: AppFormsControl;

	/** The handlers to process the request on add/delete */
	@Input() private handlers: { onSelect: (item: AttachmentInfo) => void; onEdit: (item: AttachmentInfo) => void; onDelete: (item: AttachmentInfo) => void; };

	/** The settings (allow add/delete, show show item's image/description, position of desscription) */
	@Input() private settings: { [key: string]: any };

	private _allowSelect: boolean;
	private _allowDelete: boolean;
	private _allowEdit: boolean;
	private current: AttachmentInfo;

	get locale() {
		return this.configSvc.locale;
	}

	get attachments() {
		return (this.control !== undefined ? this.control.value as Array<AttachmentInfo> : undefined) || [];
	}

	get label() {
		return this.settings !== undefined ? this.settings.Label || this.settings.label : undefined;
	}

	get allowSelect() {
		return this._allowSelect;
	}

	get allowDelete() {
		return this._allowDelete;
	}

	get allowEdit() {
		return this._allowEdit;
	}

	ngOnInit() {
		this.settings = AppUtility.isObject(this.settings, true)
			? this.settings
			: this.control !== undefined && this.control.Extras !== undefined
				? this.control.Extras["Settings"] || this.control.Extras["settings"] || {}
				: {};

		this._allowSelect = this.settings.AllowSelect !== undefined || this.settings.allowSelect !== undefined
			? !!(this.settings.AllowSelect || this.settings.allowSelect)
			: true;

		this._allowDelete = this.settings.AllowDelete !== undefined || this.settings.allowDelete !== undefined
			? !!(this.settings.AllowDelete || this.settings.allowDelete)
			: true;

		this._allowEdit = this.settings.AllowEdit !== undefined || this.settings.allowEdit !== undefined
			? !!(this.settings.allowEdit || this.settings.allowEdit)
			: false;
	}

	track(index: number, item: AttachmentInfo) {
		return `${item.ID}@${index}`;
	}

	getIcon(item: AttachmentInfo) {
		return item.ContentType.indexOf("image/") > -1
			? "image"
			: item.ContentType.indexOf("video/") > -1
				? "videocam"
				: item.ContentType.indexOf("audio/") > -1
					? "volume-medium"
					: item.ContentType.indexOf("text/") > -1
						? "document-text"
						: "document-attach";
	}

	getFilename(attachment: AttachmentInfo) {
		const filename = attachment.Filename;
		return filename.length < 43 ? filename : "..." + filename.substr(filename.length - 40);
	}

	checked(attachment: AttachmentInfo) {
		return this.current !== undefined && this.current.ID === attachment.ID;
	}

	onSelect(event: any, attachment: AttachmentInfo) {
		this.current = event.detail.checked ? attachment : undefined;
		if (this.handlers !== undefined && this.handlers.onSelect !== undefined && typeof this.handlers.onSelect === "function") {
			this.handlers.onSelect(this.current);
		}
	}

	onEdit(event: Event, attachment: AttachmentInfo) {
		event.stopPropagation();
		if (this.handlers !== undefined && this.handlers.onEdit !== undefined && typeof this.handlers.onEdit === "function") {
			this.handlers.onEdit(attachment);
		}
	}

	onDelete(event: Event, attachment: AttachmentInfo) {
		event.stopPropagation();
		if (this.handlers !== undefined && this.handlers.onDelete !== undefined && typeof this.handlers.onDelete === "function") {
			this.handlers.onDelete(attachment);
		}
	}

}
