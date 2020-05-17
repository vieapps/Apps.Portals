import { Injectable } from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { AppXHR } from "@components/app.apis";
import { AppCrypto } from "@components/app.crypto";
import { AppUtility } from "@components/app.utility";
import { Base as BaseService } from "@services/base.service";
import { ConfigurationService } from "@services/configuration.service";

/** Presents the header for uploading files */
export interface UploadFileHeader {
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
}

@Injectable()
export class FilesService extends BaseService {

	constructor(
		http: HttpClient,
		private configSvc: ConfigurationService
	) {
		super("Files");
		AppXHR.initialize(http);
	}

	/** Reads the file content as data URL (base64-string) */
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

	/** Gets the multipart/form-data body from the collection of files to upload to HTTP service of files */
	public getMultipartBody(files: Array<File>) {
		const body = new FormData();
		(files || []).forEach(file => body.append("files[]", file, file !== undefined ? file.name : ""));
		return body;
	}

	/** Gets the header for uploading files to Files HTTP service */
	public getUploadHeader(additional?: { [header: string]: string }, asBase64?: boolean) {
		const header = this.configSvc.appConfig.getAuthenticatedHeaders();
		Object.keys(additional || {}).forEach(name => header[name] = additional[name]);
		Object.keys(header).filter(name => !AppUtility.isNotEmpty(header[name])).forEach(name => delete header[name]);
		if (AppUtility.isTrue(asBase64)) {
			header["x-as-base64"] = "true";
		}
		return header;
	}

	/** Uploads a file (multipart/form-data or base64) to HTTP service of files with uploading progress report */
	public upload(path: string, data: string | Array<string> | FormData, header: { [key: string]: string }, onNext?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		const asBase64 = !(data instanceof FormData);
		return AppXHR.http.post(
			AppXHR.getURI(path, this.configSvc.appConfig.URIs.files),
			asBase64 ? { Data: data } : data,
			{
				headers: this.getUploadHeader(header, asBase64),
				reportProgress: true,
				observe: "events"
			}
		).subscribe(
			event => {
				if (event.type === HttpEventType.UploadProgress) {
					const percentage = Math.round(event.loaded / event.total * 100) + "%";
					if (this.configSvc.isDebug) {
						console.log(super.getLogMessage(`Uploading... ${percentage}`));
					}
					if (onProgress !== undefined) {
						onProgress(percentage);
					}
				}
				else if (event.type === HttpEventType.Response) {
					if (onNext !== undefined) {
						onNext(event.body);
					}
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

	/** Uploads a file (multipart/form-data or base64) to HTTP service of files */
	public async uploadAsync(path: string, data: string | Array<string> | FormData, header: { [key: string]: string }, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			const asBase64 = !(data instanceof FormData);
			const response = await AppXHR.http.post(
				AppXHR.getURI(path, this.configSvc.appConfig.URIs.files),
				asBase64 ? { Data: data } : data,
				{
					headers: this.getUploadHeader(header, asBase64),
					observe: "body"
				}
			).toPromise();
			if (onNext !== undefined) {
				onNext(response);
			}
		}
		catch (error) {
			console.error(super.getErrorMessage("Error occurred while uploading", error), error);
			if (onError !== undefined) {
				onError(AppUtility.parseError(error));
			}
		}
	}

	/** Gets header for working with uploading file */
	public getUploadFileHeader(header: UploadFileHeader, additional?: { [header: string]: string }) {
		const headers: { [header: string]: string } = {
			"x-service-name": header.ServiceName,
			"x-object-name": header.ObjectName,
			"x-system-id": header.SystemID,
			"x-repository-id": header.RepositoryID,
			"x-repository-entity-id": header.RepositoryEntityID,
			"x-object-id": header.ObjectID,
			"x-object-title": AppCrypto.urlEncode(header.ObjectTitle || ""),
			"x-file-shared": AppUtility.isTrue(header.IsShared) ? "true" : undefined,
			"x-file-tracked": AppUtility.isTrue(header.IsTracked) ? "true" : undefined,
			"x-file-temporary": AppUtility.isTrue(header.IsTemporary) ? "true" : undefined
		};
		Object.keys(additional || {}).forEach(name => headers[name] = additional[name]);
		return headers;
	}

	/** Uploads an avatar image (multipart/form-data or base64) to HTTP service of files */
	public async uploadAvatarAsync(data: string | Array<string> | FormData, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.uploadAsync("avatars", data, undefined, onNext, onError);
	}

	/** Uploads thumbnail images (multipart/form-data or base64) to HTTP service of files */
	public uploadThumbnails(data: string | Array<string> | FormData, header: UploadFileHeader, onNext?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("thumbnails", data, this.getUploadFileHeader(header), onNext, onError, onProgress);
	}

	/** Uploads thumbnail images (multipart/form-data or base64) to HTTP service of files */
	public async uploadThumbnailsAsync(data: string | Array<string> | FormData, header: UploadFileHeader, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.uploadAsync("thumbnails", data, this.getUploadFileHeader(header), onNext, onError);
	}

	/** Uploads files (multipart/form-data or base64) to HTTP service of files */
	public uploadFiles(data: FormData, header: UploadFileHeader, onNext?: (data?: any) => void, onError?: (error?: any) => void, onProgress?: (percentage: string) => void) {
		return this.upload("files", data, this.getUploadFileHeader(header), onNext, onError, onProgress);
	}

	/** Uploads files (multipart/form-data or base64) to HTTP service of files */
	public async uploadFilesAsync(data: FormData, header: UploadFileHeader, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.uploadAsync("files", data, this.getUploadFileHeader(header), onNext, onError);
	}

}
