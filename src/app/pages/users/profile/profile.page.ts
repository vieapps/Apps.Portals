import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { UserProfile } from "@app/models/user";
import { Privilege } from "@app/models/privileges";
import { UsersAvatarPage } from "../avatar/avatar.page";

@Component({
	selector: "page-users-profile",
	templateUrl: "./profile.page.html",
	styleUrls: ["./profile.page.scss"]
})

export class UsersProfilePage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService
	) {
	}

	title = "Profile";
	mode = "profile";
	id: string;
	profile: UserProfile;
	buttons = {
		ok: undefined as {
			text: string;
			icon?: string;
			handler: () => void
		},
		cancel: undefined as {
			text: string;
			icon?: string;
			handler: () => void
		},
		invite: undefined as {
			text: string;
			icon?: string;
			handler: () => void
		}
	};
	actions: Array<{
		text: string;
		role?: string;
		icon?: string;
		handler: () => void
	}>;
	labels = {
		header: "",
		lastAccess: ""
	};
	invitation = {
		form: new FormGroup({}),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>,
		privileges: undefined as Array<Privilege>,
		relatedInfo: undefined as { [key: string]: any }
	};

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	get isSystemAdministrator() {
		return this.authSvc.isSystemAdministrator();
	}

	get canManageUsers() {
		return this.isSystemAdministrator && !this.configSvc.previousURL.startsWith(this.configSvc.appConfig.URLs.users.list) && !this.configSvc.previousURL.startsWith(this.configSvc.appConfig.URLs.users.search);
	}

	get canSetServicePrivileges() {
		return this.authSvc.canSetServicePrivileges;
	}

	get listURL() {
		return this.configSvc.appConfig.URLs.users.list;
	}

	get isAuthenticated() {
		return this.configSvc.isAuthenticated;
	}

	get activeService() {
		return this.configSvc.appConfig.services.active;
	}

	ngOnInit() {
		this.id = this.configSvc.requestParams["ID"];
		this.profile = UserProfile.get(this.id || this.configSvc.getAccount().id);
		this.showProfileAsync();
	}

	setModeAsync(mode: string, title: string) {
		this.mode = mode;
		this.configSvc.appTitle = this.title = title;
		return Promise.all([
			this.prepareButtonsAsync(),
			this.prepareActionsAsync()
		]);
	}

	async prepareButtonsAsync() {
		if (this.mode === "invitation") {
			this.buttons.cancel = { text: await this.configSvc.getResourceAsync("common.buttons.cancel"), handler: async () => await this.showProfileAsync() };
			this.buttons.ok = { text: await this.configSvc.getResourceAsync("users.profile.buttons.invite"), handler: async () => await this.sendInvitationAsync() };
		}
		else {
			this.buttons.cancel = undefined;
			this.buttons.ok = undefined;
		}

		this.buttons.invite = this.mode === "profile" && this.profile.ID === this.configSvc.getAccount().id && this.authSvc.canSendInvitations
			? { text: await this.configSvc.getResourceAsync("users.profile.buttons.invitation"), icon: "people", handler: async () => await this.openSendInvitationAsync() }
			: undefined;
	}

	async prepareActionsAsync() {
		if (this.mode === "profile") {
			this.actions = [];

			if (this.profile.ID === this.configSvc.getAccount().id) {
				[
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("users.profile.actions.avatar"), "camera", () => this.openAvatarAsync()),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("users.profile.actions.profile"), "create", () => this.openUpdateAsync("profile")),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("users.profile.actions.password"), "key", () => this.openUpdateAsync("password")),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("users.profile.actions.email"), "at", () => this.openUpdateAsync("email")),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("users.profile.actions.otp"), "lock-open", () => this.openOTPAsync())
				].forEach(action => this.actions.push(action));
			}

			else if (this.authSvc.canSetServicePrivileges) {
				this.actions.push(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("users.profile.actions.privileges"), "settings", () => this.openUpdateAsync("privileges")));
				this.usersSvc.getServicePrivilegesAsync(this.profile.ID);
			}

			if (this.id === undefined || this.id === this.configSvc.getAccount().id) {
				this.actions.push(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("users.profile.actions.logout"), "log-out", () => this.logoutAsync()));
			}

			this.actions = this.actions.length > 0 ? this.actions : undefined;
		}
	}

	showActionsAsync() {
		return this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async showProfileAsync(onNext?: () => void) {
		const id = this.id || this.configSvc.getAccount().id;
		const showProfileAsync = async () => {
			this.profile = this.profile || UserProfile.get(id);
			this.labels.header = await this.configSvc.getResourceAsync("users.profile.labels.header");
			this.labels.lastAccess = await this.configSvc.getResourceAsync("users.profile.labels.lastAccess");
			await this.setModeAsync("profile", await this.configSvc.getResourceAsync("users.profile.title"));
			await Promise.all([
				this.trackAsync(this.title),
				this.appFormsSvc.hideLoadingAsync(onNext)
			]);
		};
		const force = this.configSvc.appConfig.services.active === "Books" && (this.profile === undefined || this.profile.LastSync === undefined);
		if (this.profile === undefined || force) {
			await this.appFormsSvc.showLoadingAsync();
			await this.usersSvc.getProfileAsync(
				id,
				async _ => {
					this.profile = UserProfile.get(id);
					if (id === this.configSvc.getAccount().id) {
						AppEvents.broadcast("Profile", { Type: "Updated", Mode: "APIs" });
						AppEvents.sendToElectron("Users", { Type: "Profile", Mode: "APIs", Data: this.profile });
					}
					await Promise.all([
						TrackingUtility.trackEventAsync("Users:Profile", "Reload", "Force reload to get last sync", false),
						showProfileAsync()
					]);
				},
				async error => await Promise.all([
					TrackingUtility.trackEventAsync("Users:Profile", "Reload", "Force reload to get last sync", false),
					this.appFormsSvc.showErrorAsync(error)
				]),
				true,
				force
			);
		}
		else {
			await showProfileAsync();
		}
	}

	async openAvatarAsync() {
		await this.trackAsync("Avatar", `${this.configSvc.appConfig.URLs.users.profile}/avatar`, "Open", "Users:Avatar");
		await this.appFormsSvc.showModalAsync(
			UsersAvatarPage,
			{
				mode: AppUtility.isEquals(this.profile.Avatar, "") || AppUtility.isEquals(this.profile.Avatar, this.profile.Gravatar) ? "Gravatar" : "Avatar",
				avatarURI: this.profile.Avatar,
				gravatarURI: this.profile.Gravatar
			},
			async data => await this.updateAvatarAsync(data)
		);
	}

	async updateAvatarAsync(data: any) {
		const mode = data.mode as string;
		if (mode !== undefined) {
			const imageURI = data.imageURI as string;
			if (AppUtility.isEquals(mode, "Avatar") ? imageURI !== undefined : !AppUtility.isEquals(this.profile.Avatar, "")) {
				await this.usersSvc.updateProfileAsync(
					{
						ID: this.profile.ID,
						Avatar: imageURI || ""
					},
					async () => {
						AppEvents.broadcast("Profile", { Type: "Updated" });
						await this.configSvc.storeSessionAsync(async () => await Promise.all([
							this.trackAsync("Avatar", `${this.configSvc.appConfig.URLs.users.update}/avatar`, !!imageURI ? "Upload" : "Update", "Users:Avatar"),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.avatar.message"))
						]));
					},
					async error => {
						console.error(`Error occurred while updating profile with new avatar image => ${AppUtility.getErrorMessage(error)}`, error);
						await this.trackAsync("Avatar", `${this.configSvc.appConfig.URLs.users.update}/avatar`, !!imageURI ? "Upload" : "Update", "Users:Avatar");
					}
				);
			}
		}
	}

	openUpdateAsync(mode?: string) {
		return this.configSvc.navigateForwardAsync(`${this.configSvc.appConfig.URLs.users.update}/${(this.id === undefined ? "my" : AppUtility.toANSI(this.profile.Name, true))}?x-request=${AppCrypto.jsonEncode({ ID: this.profile.ID, Mode: mode || "profile" })}`);
	}

	openOTPAsync() {
		return this.configSvc.navigateForwardAsync(this.configSvc.appConfig.URLs.users.otp);
	}

	onServicePrivilegesChanged(event: any) {
		this.invitation.privileges = event.privileges;
		this.invitation.relatedInfo = event.relatedInfo;
	}

	async openSendInvitationAsync() {
		this.invitation.config = [
			{
				Name: "Name",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.register.controls.Name.label"),
					MinLength: 1,
					MaxLength: 150,
					AutoFocus: true
				}
			},
			{
				Name: "Email",
				Required: true,
				Options: {
					Type: "email",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Email"),
					MinLength: 1,
					MaxLength: 150
				}
			}
		];
		await this.setModeAsync("invitation", await this.configSvc.getResourceAsync("users.profile.invitation.title"));
		await this.trackAsync("Invitation | Request", `${this.configSvc.appConfig.URLs.users.profile}/invite`, "Open", "Users:Invitation");
	}

	async sendInvitationAsync() {
		if (this.invitation.form.invalid) {
			this.appFormsSvc.highlightInvalids(this.invitation.form);
		}
		else {
			await this.appFormsSvc.showLoadingAsync(this.title);
			await this.usersSvc.sendInvitationAsync(
				this.invitation.form.value.Name,
				this.invitation.form.value.Email,
				this.invitation.privileges,
				this.invitation.relatedInfo,
				async () => await Promise.all([
					this.trackAsync("Invitation | Success", `${this.configSvc.appConfig.URLs.users.root}/invite`, "Send", "Users:Invitation"),
					this.showProfileAsync(async () => await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.invitation.message")))
				]),
				async error => await Promise.all([
					this.appFormsSvc.showErrorAsync(error),
					this.trackAsync("Invitation | Error", `${this.configSvc.appConfig.URLs.users.root}/invite`, "Send", "Users:Invitation")
				])
			);
		}
	}

	async logoutAsync() {
		const button = await this.configSvc.getResourceAsync("users.profile.buttons.logout");
		await this.trackAsync(button, `${this.configSvc.appConfig.URLs.users.root}/logout`, "LogOut", "Users:Account");
		await this.appFormsSvc.showAlertAsync(
			button,
			undefined,
			await this.configSvc.getResourceAsync("users.profile.logout.confirm"),
			async () => {
				await this.appFormsSvc.showLoadingAsync(button);
				await this.authSvc.logOutAsync(
					async () => await Promise.all([
						this.trackAsync(button, `${this.configSvc.appConfig.URLs.users.root}/logout`, "LogOut", "Users:Account"),
						this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.logout.success"))),
						this.configSvc.previousURL.startsWith(this.configSvc.appConfig.URLs.users.root) ? this.configSvc.navigateRootAsync() : this.configSvc.navigateBackAsync()
					]),
					async error => await Promise.all([
						this.appFormsSvc.showErrorAsync(error),
						this.trackAsync(button, `${this.configSvc.appConfig.URLs.users.root}/logout`, "LogOut", "Users:Account")
					])
				);
			},
			button,
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	private async trackAsync(title: string, url?: string, action?: string, category?: string) {
		await TrackingUtility.trackAsync({ title: `Users - ${title}`, campaignUrl: url || this.configSvc.appConfig.URLs.users.profile, category: category || "Users:Profile", action: action || "View" }, false);
	}

}
