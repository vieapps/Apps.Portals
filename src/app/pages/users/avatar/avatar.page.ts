import { Component, OnInit, Input, ViewChild } from "@angular/core";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { FilesService } from "@app/services/files.service";
import { ImageCropperControl } from "@app/controls/common/image.cropper.control";

@Component({
	selector: "page-users-avatar",
	templateUrl: "./avatar.page.html",
	styleUrls: ["./avatar.page.scss"]
})

export class UsersAvatarPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private filesSvc: FilesService
	) {
	}

	@Input() mode: string;
	@Input() avatarURI: string;
	@Input() gravatarURI: string;

	title = "Avatar";
	labels = {
		cancel: "Cancel",
		update: "Update",
		header: "Avatar type",
		avatar: "Uploaded avatar",
		gravatar: "Gravatar picture",
	};
	processing = false;
	imageCropperSettings = { currentImage: undefined };

	@ViewChild(ImageCropperControl, { static: true }) private imageCropper: ImageCropperControl;

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.imageCropperSettings.currentImage = AppUtility.isNotEmpty(this.avatarURI) ? this.avatarURI : undefined;
		this.initializeResourcesAsync();
	}

	private async initializeResourcesAsync() {
		this.title = await this.configSvc.getResourceAsync("users.profile.avatar.title");
		this.labels = {
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			update: await this.configSvc.getResourceAsync("common.buttons.update"),
			header: await this.configSvc.getResourceAsync("users.profile.avatar.header"),
			avatar: await this.configSvc.getResourceAsync("users.profile.avatar.mode.avatar"),
			gravatar: await this.configSvc.getResourceAsync("users.profile.avatar.mode.gravatar")
		};
	}

	onModeChanged(event: any) {
		this.mode = event.detail.value;
	}

	updateAsync() {
		this.processing = true;
		return AppUtility.isEquals(this.mode, "Avatar") && this.imageCropper.data !== undefined
			? this.filesSvc.uploadAvatarAsync(
					this.imageCropper.data,
					async data => await this.closeAsync(this.mode, data.URI),
					error => {
						console.error(`Error occurred while uploading avatar image => ${AppUtility.getErrorMessage(error)}`);
						this.processing = false;
					}
				)
			: this.closeAsync(this.mode);
	}

	closeAsync(mode?: string, imageURI?: string) {
		return this.appFormsSvc.hideModalAsync({
			mode: mode,
			imageURI: imageURI
		});
	}

}
