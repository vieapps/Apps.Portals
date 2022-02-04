import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { HashSet } from "@app/components/app.collections";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { FilesService, FileOptions } from "@app/services/files.service";
import { AttachmentInfo } from "@app/models/base";

@Component({
	selector: "page-files-processor",
	templateUrl: "./file.processor.modal.page.html",
	styleUrls: ["./file.processor.modal.page.scss"]
})

export class FilesProcessorModalPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@Input() mode: string;
	@Input() private fileOptions: FileOptions;
	@Input() private attachment: AttachmentInfo;
	@Input() private handlers: {
		onSelect?: (attachments: AttachmentInfo[]) => void;
		onEdit?: (attachment: AttachmentInfo) => void;
		onDelete?: (attachment: AttachmentInfo) => void;
		onUploaded?: (data: any) => void;
		predicate?: (attachment: AttachmentInfo) => boolean;
	};
	@Input() private temporary: boolean;
	@Input() private buttonLabels: {
		select: string;
		cancel: string;
		update: string;
		upload: string;
	};
	@Input() multiple: boolean;
	@Input() allowSelect: boolean;
	@Input() allowEdit: boolean;
	@Input() allowDelete: boolean;
	@Input() showIcons: boolean;
	@Input() accept: string;
	@Input() private headerOptions: Array<{ name: string; value: any; label: string; }>;

	@ViewChild("filesSelector", { static: false }) private filesSelector: ElementRef;

	processing = false;
	attachments: Array<AttachmentInfo>;
	selected = new HashSet<string>();
	buttons = {
		select: "Select",
		cancel: "Cancel",
		update: "Update",
		upload: "Upload"
	};
	form: FormGroup;
	labels = {
		title: "",
		description: "",
		shared: "",
		tracked: "",
		filename: "",
		uri: ""
	};
	files = new Array<{ data: File; percentage: string }>();
	headers = new Array<{ name: string; value: any; label: string; }>();

	private hash = "";
	private subscriptions: Array<Subscription>;
	private uploadedInfo = {
		data: [],
		headers: {} as { [key: string]: string }
	};

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.mode = AppUtility.isNotEmpty(this.mode) ? this.mode.trim().toLowerCase() : "select";
		this.handlers = this.handlers || {};
		this.temporary = this.temporary !== undefined ? AppUtility.isTrue(this.temporary) : false;
		this.multiple = this.temporary
			? false
			: this.multiple !== undefined ? AppUtility.isTrue(this.multiple) : true;
		this.allowSelect = typeof this.handlers.onSelect === "function"
			? this.allowSelect !== undefined ? AppUtility.isTrue(this.allowSelect) : false
			: false;
		this.allowDelete = typeof this.handlers.onDelete === "function"
			? this.allowDelete !== undefined ? AppUtility.isTrue(this.allowDelete) : false
			: false;
		this.allowEdit = typeof this.handlers.onEdit === "function"
			? this.allowEdit !== undefined ? AppUtility.isTrue(this.allowEdit) : false
			: false;
		this.showIcons = this.showIcons !== undefined ? AppUtility.isTrue(this.showIcons) : false;
		this.accept = AppUtility.isNotEmpty(this.accept) ? this.accept.trim().toLowerCase() : "*";
		this.buttonLabels = this.buttonLabels || { select: undefined, cancel: undefined, update: undefined, upload: undefined };
		this.headers = (this.headerOptions || []).take(3);
		this.headers.forEach(header => this.uploadedInfo.headers[header.name] = header.value);
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscriptions !== undefined) {
			this.subscriptions.filter(subscription => subscription !== undefined).forEach(subscription => subscription.unsubscribe());
		}
	}

	async initializeAsync() {
		this.buttons = {
			select: this.buttonLabels.select || await this.configSvc.getResourceAsync("common.buttons.select"),
			cancel: this.buttonLabels.cancel || await this.configSvc.getResourceAsync("common.buttons.cancel"),
			update: this.buttonLabels.update || await this.configSvc.getResourceAsync("common.buttons.update"),
			upload: this.buttonLabels.upload || await this.configSvc.getResourceAsync("common.buttons.upload")
		};
		if (this.mode === "edit") {
			this.initializeUpdateFormAsync();
		}
		else if (this.mode === "select") {
			this.appFormsSvc.showLoadingAsync().then(() => this.filesSvc.searchAttachmentsAsync(this.fileOptions, attachments => {
				this.attachments = typeof this.handlers.predicate === "function" ? attachments.filter(this.handlers.predicate) : attachments;
				this.appFormsSvc.hideLoadingAsync();
			}));
		}
	}

	track(index: number, info: any) {
		return `${info.ID || info.name}@${index}`;
	}

	onSelect(event: any, attachment: AttachmentInfo) {
		if (event.detail.checked) {
			if (!this.multiple) {
				this.selected.clear();
			}
			this.selected.add(attachment.ID);
		}
		else {
			this.selected.remove(attachment.ID);
		}
		this.handlers.onSelect(this.attachments.filter(a => this.selected.contains(a.ID)));
	}

	onEdit(event: Event, attachment: AttachmentInfo) {
		event.stopPropagation();
		this.handlers.onEdit(attachment);
	}

	onDelete(event: Event, attachment: AttachmentInfo) {
		event.stopPropagation();
		this.handlers.onDelete(attachment);
	}

	onChanged(event: any, index: number) {
		this.uploadedInfo.headers[this.headers[index].name] = event.detail.checked ? this.headers[index].value : undefined;
	}

	close(ids?: Array<string>) {
		if (this.mode === "select") {
			if (ids === undefined || ids.length > 0) {
				this.appFormsSvc.hideModalAsync(ids === undefined ? undefined : this.attachments.filter(attachment => ids.indexOf(attachment.ID) > -1));
			}
		}
		else {
			this.appFormsSvc.hideModalAsync();
		}
	}

	private async initializeUpdateFormAsync() {
		this.labels = {
			title: await this.appFormsSvc.getResourceAsync("files.attachments.controls.title"),
			description: await this.appFormsSvc.getResourceAsync("files.attachments.controls.description"),
			shared: await this.appFormsSvc.getResourceAsync("files.attachments.controls.shared"),
			tracked: await this.appFormsSvc.getResourceAsync("files.attachments.controls.tracked"),
			filename: await this.appFormsSvc.getResourceAsync("files.attachments.controls.filename"),
			uri: await this.appFormsSvc.getResourceAsync("files.attachments.controls.uri")
		};
		this.form = new FormGroup({
			Title: new FormControl(this.attachment.Title, [Validators.required, Validators.maxLength(250)]),
			Description: new FormControl(this.attachment.Description, [Validators.maxLength(1000)]),
			IsShared: new FormControl(this.attachment.IsShared),
			IsTracked: new FormControl(this.attachment.IsTracked),
			Filename: new FormControl(this.attachment.Filename),
			URI: new FormControl(this.attachment.URIs.Direct)
		});
		this.hash = AppCrypto.hash(this.form.value);
	}

	update() {
		if (this.hash === AppCrypto.hash(this.form.value)) {
			this.appFormsSvc.hideModalAsync();
		}
		else {
			this.processing = true;
			const attachment = AppUtility.clone(this.attachment);
			attachment.Title = this.form.value.Title;
			attachment.Description = this.form.value.Description;
			attachment.IsShared = this.form.value.IsShared;
			attachment.IsTracked = this.form.value.IsTracked;
			this.filesSvc.updateAttachmentAsync(
				attachment,
				() => this.appFormsSvc.hideModalAsync(),
				error => this.appFormsSvc.showErrorAsync(error).then(() => this.processing = false)
			);
		}
	}

	trackFile(index: number, file: File) {
		return `${file.name}@${index}`;
	}

	onSelectFiles(event: any) {
		if (!this.multiple) {
			this.files.removeAll();
		}
		for (let index = 0; index < event.target.files.length; index++) {
			this.files.push({ data: event.target.files[index], percentage: "0%" });
		}
		this.filesSelector.nativeElement.value = "";
	}

	onDeleteQueuedFile(event: Event, index: number) {
		event.stopPropagation();
		this.files.removeAt(index);
	}

	uploadFiles() {
		if (this.files.length > 0) {
			const onSuccess: (index: number, data?: any) => void = (index, data) => {
				this.uploadedInfo.data.push(data);
				if (this.subscriptions !== undefined && this.subscriptions.length > index && this.subscriptions[index] !== undefined) {
					this.subscriptions[index].unsubscribe();
					this.subscriptions[index] = undefined;
				}
				if (this.subscriptions === undefined || this.subscriptions.find(subscription => subscription !== undefined) === undefined) {
					this.subscriptions = undefined;
					if (typeof this.handlers.onUploaded === "function") {
						this.appFormsSvc.hideModalAsync(this.uploadedInfo, this.handlers.onUploaded);
					}
					else {
						this.appFormsSvc.hideModalAsync();
					}
				}
			};
			const onError: (error?: any) => void = error => this.appFormsSvc.showErrorAsync(error).then(() => this.processing = false);
			const onProgress: (index: number, percentage: string) => void = (index, percentage) => this.files[index].percentage = percentage;
			this.processing = true;
			this.subscriptions = [];
			this.files.forEach((file, index) => {
				if (this.temporary) {
					this.subscriptions.push(this.filesSvc.uploadTemporaryFile(this.filesSvc.getFormData(file.data), this.fileOptions, data => onSuccess(index, data), onError, percentage => onProgress(index, percentage)));
				}
				else {
					this.subscriptions.push(this.filesSvc.uploadFile(this.filesSvc.getFormData(file.data), this.fileOptions, data => onSuccess(index, data), onError, percentage => onProgress(index, percentage)));
				}
			});
		}
	}

}
