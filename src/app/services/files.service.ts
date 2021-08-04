import { Injectable } from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { AppAPIs, AppMessage } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppFormsService, AppFormsControlConfig, AppFormsControl } from "@app/components/forms.service";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AttachmentInfo } from "@app/models/base";

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

@Injectable()
export class FilesService extends BaseService {

	constructor(
		http: HttpClient,
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService
	) {
		super("Files");
		AppAPIs.initializeHttpClient(http);
		AppAPIs.registerAsServiceScopeProcessor(this.name, message => AppEvents.broadcast(this.name, { Object: message.Type.Object, Event: message.Type.Event, ObjectID: message.Data.ObjectID, Data: message.Data }));
	}

	private get http() {
		return AppAPIs.http;
	}

	public readAsDataURL(file: File, onRead: (data: string) => void, limitSize?: number, onLimitExceeded?: (fileSize?: number, limitSize?: number) => void) {
		if (limitSize !== undefined && file.size > limitSize) {
			console.warn(super.getLogMessage(`Limit size exceeded - Max allowed size: ${limitSize} bytes - Actual size: ${file.size} bytes`));
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

	public getUploadHeaders(additional?: { [header: string]: string }, asBase64?: boolean) {
		const headers = this.configSvc.appConfig.getAuthenticatedHeaders();
		Object.keys(additional || {}).forEach(name => headers[name] = additional[name]);
		Object.keys(headers).filter(name => !AppUtility.isNotEmpty(headers[name])).forEach(name => delete headers[name]);
		if (AppUtility.isTrue(asBase64)) {
			headers["x-as-base64"] = "true";
		}
		return headers;
	}

	public getFileHeaders(options: FileOptions, additional?: { [header: string]: string }) {
		const headers: { [header: string]: string } = {
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
		Object.keys(options.Extras || {}).forEach(name => headers[name] = options.Extras[name]);
		Object.keys(additional || {}).forEach(name => headers[name] = additional[name]);
		return headers;
	}

	public upload(path: string, data: string | Array<string> | FormData, headers: { [key: string]: string }, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		const asBase64 = !(data instanceof FormData);
		return this.http.post(
			AppAPIs.getURI(path, this.configSvc.appConfig.URIs.files),
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
				console.error(super.getErrorMessage("Error occurred while uploading", error), error);
				if (onError !== undefined) {
					onError(AppUtility.parseError(error));
				}
			}
		);
	}

	public async uploadAsync(path: string, data: string | Array<string> | FormData, headers: { [key: string]: string }, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			const asBase64 = !(data instanceof FormData);
			const response = await this.http.post(
				AppAPIs.getURI(path, this.configSvc.appConfig.URIs.files),
				asBase64 ? { Data: data } : data,
				{
					headers: this.getUploadHeaders(headers, asBase64),
					observe: "body"
				}
			).toPromise();
			if (onSuccess !== undefined) {
				onSuccess(response);
			}
		}
		catch (error) {
			console.error(super.getErrorMessage("Error occurred while uploading", error), error);
			if (onError !== undefined) {
				onError(AppUtility.parseError(error));
			}
		}
	}

	public async uploadAvatarAsync(data: string | Array<string> | FormData, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.uploadAsync("avatars", data, undefined, onSuccess, onError);
	}

	public uploadThumbnail(data: string | Array<string> | FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("thumbnails", data, this.getFileHeaders(options), onSuccess, onError, onProgress);
	}

	public async uploadThumbnailAsync(data: string | Array<string> | FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.uploadAsync("thumbnails", data, this.getFileHeaders(options), onSuccess, onError);
	}

	public uploadFile(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("files", data, this.getFileHeaders(options), onSuccess, onError, onProgress);
	}

	public async uploadFileAsync(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.uploadAsync("files", data, this.getFileHeaders(options), onSuccess, onError);
	}

	public uploadTemporaryFile(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("temp.file", data, this.getFileHeaders(options), onSuccess, onError, onProgress);
	}

	public async uploadTemporaryFileAsync(data: FormData, options: FileOptions, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.uploadAsync("temp.file", data, this.getFileHeaders(options), onSuccess, onError);
	}

	public getTemporaryFileURI(message: AppMessage) {
		const query = this.configSvc.appConfig.getAuthenticatedHeaders();
		query["x-node"] = message.Data.NodeID;
		query["x-filename"] = message.Data.Filename;
		return `${this.configSvc.appConfig.URIs.apis}temp.download?${AppUtility.getQueryOfJson(query)}`;
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
		const controlConfig = {
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
		} as AppFormsControlConfig;

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
						async () => await this.appFormsSvc.showToastAsync("Too big...")
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
						PlatformUtility.copyToClipboard(value.current, async () => await this.appFormsSvc.showToastAsync("Copied..."));
					}
				}
			};
		}

		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public async searchThumbnailsAsync(options: FileOptions, onSuccess?: (thumbnails: AttachmentInfo[]) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		await super.searchAsync(
			super.getSearchURI("thumbnails", this.configSvc.relatedQuery),
			undefined,
			data => {
				if (onSuccess !== undefined) {
					onSuccess((data as Array<AttachmentInfo> || []).map(thumbnail => this.prepareAttachment(thumbnail)));
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching thumbnails", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			true,
			useXHR,
			this.getFileHeaders(options, { "x-as-attachments": "true" })
		);
	}

	public async deleteThumbnailAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await super.deleteAsync(
			super.getURI("thumbnail", id),
			data => {
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a thumbnail", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	public getAttachmentsFormControl(name: string, segment: string, label: string, allowSelect: boolean = false, allowDelete: boolean = false, allowEdit: boolean = false, editAttachmentModalPage?: any, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig = {
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
		} as AppFormsControlConfig;

		if (allowDelete) {
			controlConfig.Extras.settings.handlers.onDelete = async (attachment: AttachmentInfo) => await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("files.attachments.confirm", { name: attachment.Filename }),
				undefined,
				async () => {
					await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.buttons.delete"));
					await this.deleteAttachmentAsync(
						attachment.ID,
						async _ => await this.appFormsSvc.hideLoadingAsync(),
						async error => await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error)),
						{
							"x-service-name": attachment.ServiceName,
							"x-object-name": attachment.ObjectName,
							"x-system-id": attachment.SystemID,
							"x-entity": attachment.EntityInfo,
							"x-object-id": attachment.ObjectID
						}
					);
				},
				await this.configSvc.getResourceAsync("common.buttons.delete"),
				await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}

		if (allowEdit && editAttachmentModalPage !== undefined) {
			controlConfig.Extras.settings.handlers.onEdit = async (attachment: AttachmentInfo) => await this.appFormsSvc.showModalAsync(
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

	public async searchAttachmentsAsync(options: FileOptions, onSuccess?: (attachments: AttachmentInfo[]) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		await super.searchAsync(
			super.getSearchURI("attachments", this.configSvc.relatedQuery),
			undefined,
			data => {
				if (onSuccess !== undefined) {
					onSuccess((data as Array<AttachmentInfo> || []).map(attachment => this.prepareAttachment(attachment)));
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching attachments", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			true,
			useXHR,
			this.getFileHeaders(options)
		);
	}

	public async updateAttachmentAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("attachment", body.ID),
			body,
			data => {
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating an attachment", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteAttachmentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await super.deleteAsync(
			super.getURI("attachment", id),
			data => {
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting an attachment", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

}
