import { Injectable } from "@angular/core";
import { HttpEventType } from "@angular/common/http";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppMessage } from "@app/components/app.objects";
import { AppFormsControlConfig, AppFormsControl } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AttachmentInfo } from "@app/models/base";

@Injectable()
export class FilesService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService
	) {
		super("Files");
		AppAPIs.registerAsServiceScopeProcessor(this.name, message => AppEvents.broadcast(this.name, { Object: message.Type.Object, Event: message.Type.Event, ObjectID: message.Data.ObjectID, Data: message.Data }));
	}

	private get http() {
		return AppAPIs.http;
	}

	public readAsDataURL(file: File, onRead: (data: string) => void, limitSize?: number, onLimitExceeded?: (fileSize?: number, limitSize?: number) => void) {
		if (limitSize !== undefined && file.size > limitSize) {
			this.showLog(`Limit size exceeded - Max allowed size: ${limitSize} bytes - Actual size: ${file.size} bytes`);
			if (onLimitExceeded !== undefined) {
				onLimitExceeded(file.size, limitSize);
			}
		}
		else {
			const fileReader = new FileReader();
			fileReader.onloadend = (event: any) => onRead(event.target.result);
			fileReader.readAsDataURL(file);
		}
	}

	public getFormData(file: File) {
		const formData = new FormData();
		formData.append("files[]", file, file.name);
		return formData;
	}

	public getUploadHeaders(additional?: { [key: string]: string }, asBase64?: boolean) {
		const headers = this.configSvc.appConfig.getAuthenticatedInfo();
		AppUtility.toKeyValuePair(additional).filter(kvp => AppUtility.isNotNull(kvp.key) && AppUtility.isNotNull(kvp.value)).forEach(kvp => headers[kvp.key.toString()] = kvp.value.toString());
		AppUtility.getAttributes(headers, key => AppUtility.isEmpty(headers[key])).forEach(key => delete headers[key]);
		if (AppUtility.isTrue(asBase64)) {
			headers["x-as-base64"] = "true";
		}
		return headers;
	}

	public getFileHeaders(options: FileOptions, additional?: { [key: string]: string }) {
		const headers: { [key: string]: string } = {
			"x-service-name": options.ServiceName,
			"x-object-name": options.ObjectName,
			"x-system-id": options.SystemID,
			"x-repository-id": options.RepositoryID,
			"x-entity": options.RepositoryEntityID,
			"x-object-id": options.ObjectID,
			"x-object-title": AppCrypto.base64urlEncode(options.ObjectTitle || ""),
			"x-shared": AppUtility.isTrue(options.IsShared) ? "true" : undefined,
			"x-tracked": AppUtility.isTrue(options.IsTracked) ? "true" : undefined,
			"x-temporary": AppUtility.isTrue(options.IsTemporary) ? "true" : undefined
		};
		AppUtility.toKeyValuePair(options.Extras).filter(kvp => AppUtility.isNotNull(kvp.key) && AppUtility.isNotNull(kvp.value)).forEach(kvp => headers[kvp.key.toString()] = kvp.value.toString());
		AppUtility.toKeyValuePair(additional).filter(kvp => AppUtility.isNotNull(kvp.key) && AppUtility.isNotNull(kvp.value)).forEach(kvp => headers[kvp.key.toString()] = kvp.value.toString());
		return headers;
	}

	public upload(path: string, data: string | Array<string> | FormData, headers: { [key: string]: string }, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		const asBase64 = !(data instanceof FormData);
		return this.http.post(
			AppAPIs.getURL(path, this.configSvc.appConfig.URIs.files),
			asBase64 ? { Data: data } : data,
			{
				headers: this.getUploadHeaders(headers, asBase64),
				reportProgress: true,
				observe: "events"
			}
		).subscribe(
			event => {
				if (event.type === HttpEventType.UploadProgress && onProgress !== undefined) {
					onProgress(Math.round(event.loaded / event.total * 100) + "%");
				}
				else if (event.type === HttpEventType.Response && onSuccess !== undefined) {
					onSuccess(event.body);
				}
			},
			error => {
				this.processError("Error occurred while uploading", error, onError);
			}
		);
	}

	public async uploadAsync(path: string, data: string | Array<string> | FormData, headers: { [key: string]: string }, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			const asBase64 = !(data instanceof FormData);
			const response = await AppUtility.toAsync(this.http.post(
				AppAPIs.getURL(path, this.configSvc.appConfig.URIs.files),
				asBase64 ? { Data: data } : data,
				{
					headers: this.getUploadHeaders(headers, asBase64),
					observe: "body"
				}
			));
			if (onSuccess !== undefined) {
				onSuccess(response);
			}
		}
		catch (error) {
			this.processError("Error occurred while uploading", error, onError);
		}
	}

	public uploadAvatarAsync(data: string | Array<string> | FormData, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.uploadAsync("avatars", data, undefined, onSuccess, onError);
	}

	public uploadThumbnail(data: string | Array<string> | FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("thumbnails", data, this.getFileHeaders(options), onSuccess, onError, onProgress);
	}

	public uploadThumbnailAsync(data: string | Array<string> | FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.uploadAsync("thumbnails", data, this.getFileHeaders(options), onSuccess, onError);
	}

	public uploadFile(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("files", data, this.getFileHeaders(options), onSuccess, onError, onProgress);
	}

	public uploadFileAsync(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.uploadAsync("files", data, this.getFileHeaders(options), onSuccess, onError);
	}

	public uploadTemporaryFile(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("temp.file", data, this.getFileHeaders(options), onSuccess, onError, onProgress);
	}

	public uploadTemporaryFileAsync(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.uploadAsync("temp.file", data, this.getFileHeaders(options), onSuccess, onError);
	}

	public getTemporaryFileURI(message: AppMessage) {
		const query = this.configSvc.appConfig.getAuthenticatedInfo();
		query["x-node"] = message.Data.NodeID;
		query["x-filename"] = message.Data.Filename;
		return `${this.configSvc.appConfig.URIs.apis}temp.download?${AppUtility.toQuery(query)}`;
	}

	public prepareAttachment(attachment: AttachmentInfo) {
		if (attachment.Created !== undefined) {
			attachment.Created = new Date(attachment.Created);
		}
		if (attachment.LastModified !== undefined) {
			attachment.LastModified = new Date(attachment.LastModified);
		}
		if (AppUtility.isNotEmpty(attachment.ContentType)) {
			attachment.isImage = attachment.ContentType.indexOf("image/") > -1;
			attachment.isVideo = attachment.ContentType.indexOf("video/") > -1;
			attachment.isAudio = attachment.ContentType.indexOf("audio/") > -1;
			attachment.isText = attachment.ContentType.indexOf("text/") > -1;
			attachment.icon = attachment.isImage
				? "image"
				: attachment.isVideo
				? "videocam"
				: attachment.isAudio
					? "volume-medium"
					: attachment.isText
						? "document-text"
						: "document-attach";
		}
		attachment.friendlyFilename = attachment.Filename.length < 47
			? attachment.Filename
			: attachment.Filename.substr(0, 40) + "..." + attachment.Filename.substr(attachment.Filename.length - 4);
		return attachment;
	}

	public getThumbnailURI(attachment: AttachmentInfo) {
		return AppUtility.isObject(attachment.URIs, true)
			? attachment.URIs.Direct
			: AppUtility.isNotEmpty(attachment.URI)
				? attachment.URI
				: this.configSvc.appConfig.URIs.files + "thumbnails/no-image.png";
	}

	public prepareAttachmentsFormControl(formControl: AppFormsControl, isThumbnails: boolean, attachments?: Array<AttachmentInfo>, addedOrUpdated?: AttachmentInfo, deleted?: AttachmentInfo, onCompleted?: (control: AppFormsControl) => void) {
		if (formControl !== undefined) {
			if (isThumbnails) {
				if (AppUtility.isArray(attachments, true) && attachments.length > 0) {
					formControl.value = { current: this.getThumbnailURI(attachments[0]), new: undefined, identity: attachments[0].ID };
				}
				else if (AppUtility.isObject(addedOrUpdated, true)) {
					formControl.value = { current: this.getThumbnailURI(addedOrUpdated), new: undefined, identity: addedOrUpdated.ID };
				}
				else if (AppUtility.isObject(deleted, true)) {
					formControl.value = { current: undefined, new: undefined, identity: deleted.ID };
				}
			}
			else {
				if (AppUtility.isArray(attachments, true)) {
					formControl.value = attachments;
				}
				attachments = formControl.value as Array<AttachmentInfo> || [];
				if (AppUtility.isObject(addedOrUpdated, true)) {
					const index = attachments.findIndex(attachment => attachment.ID === addedOrUpdated.ID);
					if (index < 0) {
						attachments.push(addedOrUpdated);
					}
					else {
						attachments[index] = addedOrUpdated;
					}
				}
				if (AppUtility.isObject(deleted, true)) {
					attachments.removeAt(attachments.findIndex(attachment => attachment.ID === deleted.ID));
				}
				formControl.value = attachments.length > 0 ? attachments.sortBy("Title", "Filename") : undefined;
			}
			if (onCompleted !== undefined) {
				onCompleted(formControl);
			}
		}
		return formControl;
	}

	public getThumbnailFormControl(name: string, segment: string, allowSelectNew: boolean = false, useDefaultHandlers: boolean = true, onCompleted?: (controlConfig: AppFormsControlConfig) => void, showCopyToClipboard: boolean = true) {
		const controlConfig: AppFormsControlConfig = {
			Name: name || "Thumbnails",
			Segment: segment || "attachments",
			Type: "FilePicker",
			Options: {
				Label: "{{files.thumbnails.label}}",
				FilePickerOptions: {
					Accept: "image/*",
					Multiple: false,
					AllowPreview: true,
					AllowSelect: allowSelectNew,
					AllowDelete: allowSelectNew
				}
			}
		};

		if (allowSelectNew && useDefaultHandlers) {
			controlConfig.Options.OnChanged = (event, formControl) => {
				const file: File = event.target !== undefined && event.target.files !== undefined && event.target.files.length > 0 ? event.target.files[0] : undefined;
				if (file !== undefined) {
					this.readAsDataURL(
						file,
						base64data => {
							const value = formControl.value;
							formControl.setValue({
								current: AppUtility.isObject(value, true) ? value.current : undefined,
								new: base64data,
								identity: AppUtility.isObject(value, true) ? value.identity : undefined
							}, { onlySelf: true });
						},
						this.configSvc.fileLimits.thumbnail,
						() => this.appFormsSvc.showToastAsync("Too big...")
					);
				}
				else {
					const value = formControl.value;
					formControl.setValue({
						current: AppUtility.isObject(value, true) ? value.current : undefined,
						new: undefined,
						identity: AppUtility.isObject(value, true) ? value.identity : undefined
					}, { onlySelf: true });
				}
			};
			controlConfig.Options.FilePickerOptions.OnDelete = (_, formControl) => {
				const value = formControl.value;
				formControl.setValue({
					current: AppUtility.isObject(value, true) ? value.current : undefined,
					new: undefined,
					identity: AppUtility.isObject(value, true) ? value.identity : undefined
				}, { onlySelf: true });
			};
		}

		if (AppUtility.isTrue(showCopyToClipboard)) {
			controlConfig.Options.Icon = {
				Name: "link",
				Fill: "clear",
				Color: "medium",
				Slot: "end",
				OnClick: (_, formControl) => {
					const value = formControl.value;
					if (value !== undefined && AppUtility.isNotEmpty(value.current)) {
						PlatformUtility.copyToClipboardAsync(value.current, () => this.appFormsSvc.showToastAsync("Copied..."));
					}
				}
			};
		}

		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public searchThumbnailsAsync(options: FileOptions, onSuccess?: (thumbnails: AttachmentInfo[]) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("thumbnails", this.configSvc.relatedQuery),
			undefined,
			data => {
				if (onSuccess !== undefined) {
					onSuccess((data as Array<AttachmentInfo> || []).map(thumbnail => this.prepareAttachment(thumbnail)));
				}
			},
			error => this.processError("Error occurred while searching thumbnails", error, onError),
			true,
			useXHR,
			this.getFileHeaders(options, { "x-as-attachments": "true" })
		);
	}

	public deleteThumbnailAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.deleteAsync(
			this.getPath("thumbnail", id),
			onSuccess,
			error => this.processError("Error occurred while deleting a thumbnail", error, onError),
			headers
		);
	}

	public getAttachmentsFormControl(name: string, segment: string, label: string, allowSelect: boolean = false, allowDelete: boolean = false, allowEdit: boolean = false, editAttachmentModalPage?: any, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
			Name: name || "Attachments",
			Segment: segment || "attachments",
			Type: "Custom",
			Extras: {
				settings: {
					label: label,
					allowSelect: allowSelect,
					allowDelete: allowDelete,
					allowEdit: allowEdit,
					handlers: {} as { [key: string]: any }
				}
			},
			Options: {
				Type: "files-selector"
			}
		};

		if (allowDelete) {
			controlConfig.Extras.settings.handlers.onDelete = async (attachment: AttachmentInfo) => this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("files.attachments.confirm", { name: attachment.Filename }),
				undefined,
				() => {
					AppUtility.invoke(async () => this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.buttons.delete"))).then(() => this.deleteAttachmentAsync(
						attachment.ID,
						() => this.appFormsSvc.hideLoadingAsync(),
						error => this.appFormsSvc.hideLoadingAsync(() => this.appFormsSvc.showErrorAsync(error)),
						{
							"x-service-name": attachment.ServiceName,
							"x-object-name": attachment.ObjectName,
							"x-system-id": attachment.SystemID,
							"x-entity": attachment.EntityInfo,
							"x-object-id": attachment.ObjectID
						}
					));
				},
				await this.configSvc.getResourceAsync("common.buttons.delete"),
				await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}

		if (allowEdit && editAttachmentModalPage !== undefined) {
			controlConfig.Extras.settings.handlers.onEdit = (attachment: AttachmentInfo) => this.appFormsSvc.showModalAsync(
				editAttachmentModalPage,
				{
					mode: "edit",
					attachment: attachment
				}
			);
		}

		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public searchAttachmentsAsync(options: FileOptions, onSuccess?: (attachments: AttachmentInfo[]) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("attachments", this.configSvc.relatedQuery),
			undefined,
			data => {
				if (onSuccess !== undefined) {
					onSuccess((data as Array<AttachmentInfo> || []).map(attachment => this.prepareAttachment(attachment)));
				}
			},
			error => this.processError("Error occurred while searching attachments", error, onError),
			true,
			useXHR,
			this.getFileHeaders(options)
		);
	}

	public updateAttachmentAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("attachment", body.ID),
			body,
			onSuccess,
			error => this.processError("Error occurred while updating an attachment", error, onError)
		);
	}

	public deleteAttachmentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.deleteAsync(
			this.getPath("attachment", id),
			onSuccess,
			error => this.processError("Error occurred while deleting an attachment", error, onError),
			headers
		);
	}

}

/** Presents the options for working with files of a business entity */
export interface FileOptions {
	ServiceName: string;
	ObjectName: string;
	SystemID?: string;
	RepositoryID?: string;
	RepositoryEntityID?: string;
	ObjectID: string;
	ObjectTitle?: string;
	IsShared?: boolean;
	IsTracked?: boolean;
	IsTemporary?: boolean;
	Extras?: { [key: string]: string };
}
