import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { UsersService } from "@services/users.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalBase as BaseModel, EmailNotificationSettings } from "@models/portals.base";
import { Organization } from "@models/portals.core.organization";
import { Privileges } from "@models/privileges";
import { UserProfile } from "@models/user";
import { Desktop } from "@models/portals.core.desktop";
import { RolesSelectorModalPage } from "@controls/portals/role.selector.modal.page";
import { UsersSelectorModalPage } from "@controls/common/user.selector.modal.page";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";

@Component({
	selector: "page-portals-core-organizations-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsOrganizationsUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private usersSvc: UsersService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		save: "Save",
		cancel: "Cancel"
	};

	private canModerateOrganization = false;
	private organization: Organization;
	private hash = "";
	private emailsByApprovalStatus = {} as { [status: string]: EmailNotificationSettings };
	private instructions = {} as {
		[type: string]: {
			[language: string]: {
				Subject?: string;
				Body?: string;
			}
		}
	};

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.organization = Organization.get(this.configSvc.requestParams["ID"]);

		this.canModerateOrganization = this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		this.organization = this.organization || new Organization("Pending", new Privileges(true));
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.organizations.title.${(AppUtility.isNotEmpty(this.organization.ID) ? "update" : "create")}`);
		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.organization.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.organizations.update.segments.basic")),
			new AppFormsSegment("privileges", await this.configSvc.getResourceAsync("portals.organizations.update.segments.privileges")),
			new AppFormsSegment("notifications", await this.configSvc.getResourceAsync("portals.organizations.update.segments.notifications")),
			new AppFormsSegment("instructions", await this.configSvc.getResourceAsync("portals.organizations.update.segments.instructions")),
			new AppFormsSegment("socials", await this.configSvc.getResourceAsync("portals.organizations.update.segments.socials")),
			new AppFormsSegment("urls", await this.configSvc.getResourceAsync("portals.organizations.update.segments.urls")),
			new AppFormsSegment("emails", await this.configSvc.getResourceAsync("portals.organizations.update.segments.emails"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const socials: Array<string> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "socials");
		const trackings: Array<string> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "trackings");

		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "organization");
		formConfig.forEach(ctrl => ctrl.Segment = "basic");
		if (AppUtility.isNotEmpty(this.organization.ID)) {
			formConfig.push(this.portalsCoreSvc.getAuditFormControl(this.organization, "basic"));
		}

		formConfig.push(
			{
				Name: "Privileges",
				Type: "Custom",
				Segment: "privileges",
				Extras: { AllowInheritFromParent: false, RolesSelector: this.portalsCoreSvc.getRolesSelector(RolesSelectorModalPage, { organizationID: this.organization.ID }) },
				Options: {
					Type: "object-privileges"
				}
			},
			this.portalsCoreSvc.getNotificationsFormControl("Notifications", "notifications", undefined, undefined, false),
			{
				Name: "Instructions",
				Segment: "instructions",
				Type: "Nothing",
				Options: {
					Description: "{{portals.organizations.controls.Instructions.description}}"
				},
				SubControls: {
					Controls: Organization.instructionElements.map(type => {
						return {
							Name: type,
							Options: {
								Label: `{{portals.organizations.controls.Instructions.${type}.label}}`
							},
							SubControls: {
								Controls: [
									{
										Name: "Language",
										Type: "Select",
										Options: {
											Label: "{{portals.organizations.controls.Instructions.language}}",
											SelectOptions: {
												Values: this.configSvc.appConfig.languages,
												Interface: "popover"
											}
										}
									},
									{
										Name: "Subject",
										Options: {
											Label: `{{portals.organizations.controls.Instructions.${type}.Subject}}`,
											MaxLength: 250
										}
									},
									{
										Name: "Body",
										Type: "TextArea",
										Options: {
											Label: `{{portals.organizations.controls.Instructions.${type}.Body}}`,
											Rows: 7
										}
									}
								]
							}
						};
					})
				}
			},
			{
				Name: "Socials",
				Segment: "socials",
				Type: "Select",
				Options: {
					Label: "{{portals.organizations.controls.Socials}}",
					SelectOptions: {
						Multiple: true,
						AsBoxes: true,
						Values: socials
					}
				}
			},
			{
				Name: "Trackings",
				Segment: "socials",
				Options: {
					Label: "{{portals.organizations.controls.Trackings.label}}"
				},
				SubControls: {
					Controls: trackings.map(tracking => {
						return {
							Name: tracking,
							Options: {
								Label: `{{portals.organizations.controls.Trackings.${tracking}.label}}`,
								Description: `{{portals.organizations.controls.Trackings.${tracking}.description}}`
							}
						};
					})
				}
			},
			{
				Name: "Others",
				Segment: "socials",
				Options: {
					Label: "{{portals.organizations.controls.Others.label}}"
				},
				SubControls: {
					Controls: [
						{
							Name: "MetaTags",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.Others.MetaTags.label}}",
								Description: "{{portals.organizations.controls.Others.MetaTags.description}}",
								Rows: 10
							}
						},
						{
							Name: "Scripts",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.Others.Scripts.label}}",
								Description: "{{portals.organizations.controls.Others.Scripts.description}}",
								Rows: 15
							}
						}
					]
				}
			},
			{
				Name: "HttpIndicators",
				Segment: "socials",
				Options: {
					Label: "{{portals.organizations.controls.HttpIndicators.label}}"
				},
				SubControls: {
					AsArray: true,
					Controls: [{
						Options: {},
						SubControls: {
							Controls: [
								{
									Name: "Name",
									Type: "TextBox",
									Options: {
										Type: "text",
										Label: "{{portals.organizations.controls.HttpIndicators.Name.label}}",
										Description: "{{portals.organizations.controls.HttpIndicators.Name.description}}",
										MaxLength: 250
									}
								},
								{
									Name: "Content",
									Type: "TextArea",
									Options: {
										Type: "text",
										Label: "{{portals.organizations.controls.HttpIndicators.Content.label}}",
										Description: "{{portals.organizations.controls.HttpIndicators.Content.description}}",
										MaxLength: 4000
									}
								}
							]
						}
					}]
				}
			},
			{
				Name: "AlwaysUseHtmlSuffix",
				Type: "YesNo",
				Segment: "urls",
				Options: {
					Label: "{{portals.organizations.controls.AlwaysUseHtmlSuffix}}",
					Type: "toggle"
				}
			},
			{
				Name: "RefreshUrls",
				Segment: "urls",
				Options: {
					Label: "{{portals.organizations.controls.RefreshUrls.label}}",
				},
				SubControls: {
					Controls: [
						{
							Name: "Addresses",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.RefreshUrls.Addresses.label}}",
								Description: "{{portals.organizations.controls.RefreshUrls.Addresses.description}}",
								Rows: 10
							}
						},
						{
							Name: "Interval",
							Type: "Range",
							Options: {
								Label: "{{portals.organizations.controls.RefreshUrls.Interval.label}}",
								Description: "{{portals.organizations.controls.RefreshUrls.Interval.description}}",
								Type: "number",
								MinValue: 5,
								MaxValue: 120,
								RangeOptions: {
									AllowPin: true,
									AllowSnaps: true,
									AllowTicks: true,
									Step: 5,
									Icons: {
										Start: "time"
									}
								}
							}
						}
					]
				}
			},
			{
				Name: "RedirectUrls",
				Segment: "urls",
				Options: {
					Label: await this.appFormsSvc.getResourceAsync("portals.organizations.controls.RedirectUrls.label")
				},
				SubControls: {
					Controls: [
						{
							Name: "Addresses",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.RedirectUrls.Addresses.label}}",
								Description: "{{portals.organizations.controls.RedirectUrls.Addresses.description}}",
								Rows: 10
							}
						},
						{
							Name: "AllHttp404",
							Type: "YesNo",
							Options: {
								Label: "{{portals.organizations.controls.RedirectUrls.AllHttp404}}",
								Type: "toggle"
							}
						}
					]
				}
			},
			this.portalsCoreSvc.getEmailSettingsFormControl("EmailSettings", "emails", false),
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (!AppUtility.isNotEmpty(this.organization.ID)) {
			control.Options.OnBlur = (_, formControl) => {
				this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true).replace(/\-/g, ""), { onlySelf: true });
				((this.form.controls.Notifications as FormGroup).controls.WebHooks as FormGroup).controls.SignKey.setValue(AppCrypto.md5(formControl.value), { onlySelf: true });
			};
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Type = "TextArea";
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Alias"));
		control.Options.OnBlur = (_, formControl) => formControl.setValue(AppUtility.toANSI(formControl.value, true).replace(/\-/g, ""), { onlySelf: true });
		control.Options.Icon = {
			Name: "globe",
			Fill: "clear",
			Color: "medium",
			Slot: "end",
			OnClick: (_, formControl) => PlatformUtility.openURI(`${this.configSvc.appConfig.URIs.portals}~${formControl.value}`)
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OwnerID"));
		control.Required = true;
		if (this.canModerateOrganization) {
			let initialValue: any;
			if (AppUtility.isNotEmpty(this.organization.OwnerID)) {
				initialValue = UserProfile.get(this.organization.OwnerID);
				if (initialValue === undefined) {
					await this.usersSvc.getProfileAsync(this.organization.OwnerID, _ => initialValue = UserProfile.get(this.organization.OwnerID), undefined, true);
				}
			}
			control.Type = "Lookup";
			control.Options.LookupOptions = {
				Multiple: false,
				AsModal: false,
				AsCompleter: true,
				CompleterOptions: {
					DataSource: this.usersSvc.completerDataSource,
					InitialValue: initialValue,
					AllowLookupByModal: true,
					OnSelected: (event, formControl) => formControl.setValue(AppUtility.isObject(event, true) && event.originalObject !== undefined && AppUtility.isNotEmpty(event.originalObject.ID) ? event.originalObject.ID : undefined)
				},
				ModalOptions: {
					Component: UsersSelectorModalPage,
					ComponentProps: { multiple: false },
					OnDismiss: (data, formControl) => {
						if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
							formControl.completerInitialValue = UserProfile.get(data[0]);
						}
					}
				}
			};
		}
		else {
			control.Type = "TextBox";
			control.Hidden = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		BaseModel.prepareApprovalStatusControl(control);
		if (!this.canModerateOrganization) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExpiredDate"));
		control.Type = "DatePicker";
		control.Required = false;
		control.Options.DatePickerOptions = { AllowTimes: false };
		if (!this.canModerateOrganization) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "FilesQuotes"));
		control.Type = "Range";
		control.Options.MinValue = 0;
		control.Options.MaxValue = 100;
		control.Options.RangeOptions = {
			AllowPin: true,
			AllowSnaps: true,
			AllowTicks: true,
			Step: 10,
			Icons: {
				Start: "cloud-done",
				End: "cloud"
			}
		};
		if (!this.canModerateOrganization) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Required2FA"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "TrackDownloadFiles"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Theme"));
		control.Options.Type = "dropdown";
		control.Options.SelectOptions.Values = (await this.portalsCoreSvc.getThemesAsync()).map(theme => {
			return { Value: theme.name, Label: theme.name };
		});

		const homeDesktopCtrl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "HomeDesktopID"));
		const searchDesktopCtrl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "SearchDesktopID"));
		homeDesktopCtrl.Options.LookupOptions = searchDesktopCtrl.Options.LookupOptions = {
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: DesktopsSelectorModalPage,
				ComponentProps: {
					multiple: false,
					organizationID: this.organization.ID
				},
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
						const desktop = Desktop.get(data[0]);
						formControl.setValue(desktop.ID);
						formControl.lookupDisplayValues = [{ Value: desktop.ID, Label: desktop.FullTitle }];
					}
				}
			}
		};

		let homeDesktop = Desktop.get(this.organization.HomeDesktopID);
		if (homeDesktop === undefined && AppUtility.isNotEmpty(this.organization.HomeDesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.organization.HomeDesktopID, _ => homeDesktop = Desktop.get(this.organization.HomeDesktopID), undefined, true);
		}
		homeDesktopCtrl.Extras = { LookupDisplayValues: homeDesktop !== undefined ? [{ Value: homeDesktop.ID, Label: homeDesktop.FullTitle }] : undefined };

		let searchDesktop = Desktop.get(this.organization.SearchDesktopID);
		if (searchDesktop === undefined && AppUtility.isNotEmpty(this.organization.SearchDesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.organization.SearchDesktopID, _ => searchDesktop = Desktop.get(this.organization.SearchDesktopID), undefined, true);
		}
		searchDesktopCtrl.Extras = { LookupDisplayValues: searchDesktop !== undefined ? [{ Value: searchDesktop.ID, Label: searchDesktop.FullTitle }] : undefined };

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Notifications"));
		this.portalsCoreSvc.prepareNotificationsFormControl(control, this.emailsByApprovalStatus);

		const instructionControls = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Instructions")).SubControls.Controls;
		Organization.instructionElements.forEach(type => {
			const controls = instructionControls.find(ctrl => AppUtility.isEquals(ctrl.Name, type)).SubControls.Controls;
			controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Language")).Options.OnChanged = (event, formControl) => {
				this.instructions[formControl.parentControl.Name] = this.instructions[formControl.parentControl.Name] || {};
				const instruction = this.instructions[formControl.parentControl.Name][event.detail.value] || {};
				formControl.formGroup.controls.Subject.setValue(instruction.Subject, { onlySelf: true });
				formControl.formGroup.controls.Body.setValue(instruction.Body, { onlySelf: true });
				formControl.parentControl.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Subject")).focus();
			};
			controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Subject")).Options.OnBlur = (_, formControl) => this.instructions[formControl.parentControl.Name][formControl.formGroup.controls.Language.value] = { Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
			controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Body")).Options.OnBlur = (_, formControl) => this.instructions[formControl.parentControl.Name][formControl.formGroup.controls.Language.value] = { Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "HttpIndicators"));
		if (AppUtility.isArray(this.organization.HttpIndicators, true) && this.organization.HttpIndicators.length > 1) {
			while (control.SubControls.Controls.length <= this.organization.HttpIndicators.length) {
				control.SubControls.Controls.push(this.appFormsSvc.cloneControl(control.SubControls.Controls[0], ctrl => {
					ctrl.Name = `${control.Name}_${control.SubControls.Controls.length}`;
					ctrl.Order = control.SubControls.Controls.length;
				}));
			}
		}
		control.SubControls.Controls.forEach((ctrl, index) => ctrl.Options.Label = `#${index + 1}`);

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.organization.ID)) {
			control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
			control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
			control.Hidden = false;
			control.Options.Label = "{{common.audits.identity}}";
			control.Options.ReadOnly = true;
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	onFormInitialized() {
		const organization = AppUtility.clone(this.organization, false, ["Notifications", "EmailSettings"]);
		organization.Privileges = Privileges.clonePrivileges(this.organization.Privileges);
		organization.ExpiredDate = AppUtility.toIsoDate(organization.ExpiredDate);

		organization.Notifications = this.portalsCoreSvc.getNotificationSettings(this.organization.Notifications, this.emailsByApprovalStatus, false);
		organization.EmailSettings = this.portalsCoreSvc.getEmailSettings(this.organization.EmailSettings, false);
		organization.Others = { MetaTags: organization.MetaTags, Scripts: organization.Scripts };

		organization.RefreshUrls = organization.RefreshUrls || {};
		organization.RefreshUrls.Addresses = AppUtility.toStr(organization.RefreshUrls.Addresses, "\n");
		organization.RefreshUrls.Interval = organization.RefreshUrls.Interval || 15;

		organization.RedirectUrls = organization.RedirectUrls || {};
		organization.RedirectUrls.Addresses = AppUtility.toStr(organization.RedirectUrls.Addresses, "\n");
		organization.RedirectUrls.AllHttp404 = organization.RedirectUrls.AllHttp404 !== undefined ? !!organization.RedirectUrls.AllHttp404 : false;

		this.instructions = organization.Instructions || {};
		Organization.instructionElements.forEach(type => {
			this.instructions[type] = this.instructions[type] || {};
			this.configSvc.appConfig.languages.map(language => language.Value).forEach(language => {
				this.instructions[type][language] = this.instructions[type][language] || { Subject: undefined as string, Body: undefined as string };
			});
		});

		organization.Instructions = {};
		Organization.instructionElements.forEach(type => {
			const instruction = this.instructions[type][this.configSvc.appConfig.language];
			organization.Instructions[type] = {
				Language: this.configSvc.appConfig.language,
				Subject: instruction.Subject,
				Body: instruction.Body
			};
		});

		delete organization["MetaTags"];
		delete organization["Scripts"];

		this.form.patchValue(organization);
		this.hash = AppCrypto.hash(this.form.value);

		// hack the Completer component to update correct form value & validity status
		this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.invoke(() => this.form.controls.OwnerID.setValue(organization.OwnerID, { onlySelf: true }), 234));
	}

	async saveAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			const organization = this.form.value;
			organization.Instructions = this.instructions;

			if (this.hash === AppCrypto.hash(organization)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				organization.ExpiredDate = organization.ExpiredDate !== undefined ? AppUtility.toIsoDate(organization.ExpiredDate).replace(/\-/g, "/") : "-";
				organization.MetaTags = organization.Others.MetaTags;
				organization.Scripts = organization.Others.Scripts;
				organization.RefreshUrls.Addresses = AppUtility.toArray(organization.RefreshUrls.Addresses, "\n").filter(value => AppUtility.isNotEmpty(value));
				organization.RedirectUrls.Addresses = AppUtility.toArray(organization.RedirectUrls.Addresses, "\n").filter(value => AppUtility.isNotEmpty(value));
				organization.OriginalPrivileges = Privileges.getPrivileges(organization.Privileges);
				this.portalsCoreSvc.normalizeNotificationSettings(organization.Notifications, this.emailsByApprovalStatus);

				delete organization["Others"];
				delete organization["Privileges"];

				if (AppUtility.isNotEmpty(organization.ID)) {
					Organization.get(organization.ID).owner = undefined;
					await this.portalsCoreSvc.updateOrganizationAsync(
						organization,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Organization", Type: "Updated", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.organizations.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.showErrorAsync(error);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createOrganizationAsync(
						organization,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Organization", Type: "Created", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.organizations.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.showErrorAsync(error);
						}
					);
				}
			}
		}
	}

	async cancelAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			undefined,
			await this.configSvc.getResourceAsync(`portals.organizations.update.messages.confirm.${AppUtility.isNotEmpty(this.organization.ID) ? "cancel" : "new"}`),
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
