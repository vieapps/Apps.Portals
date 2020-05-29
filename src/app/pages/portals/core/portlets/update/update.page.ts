import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppPagination } from "@components/app.pagination";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { AppFormsControlComponent } from "@components/forms.control.component";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { FilesService, FileOptions } from "@services/files.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { AttachmentInfo } from "@models/base";
import { Organization } from "@models/portals.core.organization";
import { ContentType } from "@models/portals.core.content.type";
import { Desktop } from "@models/portals.core.desktop";
import { Portlet } from "@models/portals.core.portlet";
import { Expression } from "@models/portals.core.expression";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";
import { FilesProcessorModalPage } from "@controls/common/file.processor.modal.page";
import { DataLookupModalPage } from "@controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-core-portlets-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsPortletsUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private portlet: Portlet;
	private organization: Organization;
	private contentType: ContentType;
	private desktop: Desktop;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private isAdvancedMode = false;
	private hash = "";

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
		update: "Update",
		cancel: "Cancel"
	};

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.desktop = Desktop.get(this.configSvc.requestParams["DesktopID"]);
		if (this.desktop === undefined) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync("/portals/core/desktop/list/all")
			]));
			return;
		}

		const portletID = this.configSvc.requestParams["ID"];
		this.portlet = Portlet.get(portletID);
		if (this.portlet === undefined && AppUtility.isNotEmpty(portletID)) {
			if (this.desktop.portlets === undefined) {
				const request = AppPagination.buildRequest(
					{ And: [{ SystemID: { Equals: this.desktop.SystemID } }, { DesktopID: { Equals: this.desktop.ID } }] },
					{ Zone: "Ascending", OrderIndex: "Ascending" },
					{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
				);
				await this.portalsCoreSvc.searchPortletAsync(request, data => this.desktop.portlets = (data as Array<any>).map(portlet => Portlet.deserialize(portlet)), undefined, true, true);
			}
			this.portlet = this.desktop.portlets.find(portlet => portlet.ID === portletID);
		}
		this.organization = Organization.get(this.desktop.SystemID) || this.portalsCoreSvc.activeOrganization || new Organization();

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		if (this.portlet === undefined) {
			this.portlet = new Portlet(this.desktop.SystemID, this.desktop.ID, this.configSvc.requestParams["RepositoryEntityID"]);
			this.portlet.CommonSettings = {
				HideTitle: true,
				TitleUISettings: {},
				ContentUISettings: {}
			};
			this.portlet.ListSettings = {
				PageSize: 7,
				AutoPageNumber: true,
				ShowBreadcrumbs: true,
				ShowPagination: true
			};
			this.portlet.ViewSettings = {
				ShowBreadcrumbs: true,
				ShowPagination: true
			};
			this.portlet.PaginationSettings = {
				PreviousPageLabel: "Previous",
				NextPageLabel: "Next",
				CurrentPageLabel: "Page",
				ShowPageLinks: true
			};
			this.portlet.BreadcrumbSettings = {
				SeperatedLabel: ">",
				HomeLabel: "Home",
				ShowModuleLink: false,
				ShowContentTypeLink: false
			};
			this.isAdvancedMode = this.isSystemModerator;
		}
		else {
			this.isAdvancedMode = AppUtility.isTrue(this.configSvc.requestParams["Advanced"]);
		}

		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.portlet.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.contentType = ContentType.get(this.portlet.RepositoryEntityID);
		if (this.contentType === undefined && AppUtility.isNotEmpty(this.portlet.RepositoryEntityID)) {
			await this.portalsCoreSvc.getContentTypeAsync(this.portlet.RepositoryEntityID, _ => this.contentType = ContentType.get(this.portlet.RepositoryEntityID), undefined, true);
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.portlets.title.${(AppUtility.isNotEmpty(this.portlet.ID) ? "update" : "create")}`);
		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.portlet.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("common", await this.configSvc.getResourceAsync("portals.portlets.update.segments.common")),
			new AppFormsSegment("list", await this.configSvc.getResourceAsync("portals.portlets.update.segments.list")),
			new AppFormsSegment("view", await this.configSvc.getResourceAsync("portals.portlets.update.segments.view")),
			new AppFormsSegment("other", await this.configSvc.getResourceAsync("portals.portlets.update.segments.other")),
			new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "portlet");

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "MainAction")).Options.SelectOptions.Values =
			formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "SubAction")).Options.SelectOptions.Values = ["List", "View"].map(id => `{{portals.portlets.actions.${id}}}`);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "DesktopID"));
		if (this.isAdvancedMode) {
			control.Type = "Lookup";
			control.Extras = { LookupDisplayValues: [{ Value: this.desktop.ID, Label: this.desktop.FullTitle }] };
			control.Options.LookupOptions = {
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
							const selectedDesktop = Desktop.get(data[0]);
							formControl.setValue(selectedDesktop.ID);
							formControl.lookupDisplayValues = [{ Value: selectedDesktop.ID, Label: selectedDesktop.FullTitle }];
						}
					}
				}
			};
		}
		else {
			control.Hidden = true;
			AppUtility.insertAt(
				formConfig,
				{
					Name: "Desktop",
					Type: "Text",
					Segment: "common",
					Extras: { Text: `${this.organization.Title} :: ${this.desktop.FullTitle}` },
					Options: {
						Label: "{{portals.portlets.controls.Desktop}}",
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => ctrl.Name === control.Name)
			);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryEntityID"));
		if (this.isAdvancedMode) {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.organization.contentTypes.filter(contType => contType.contentTypeDefinition.Portlets).map(contType => {
				return { Value: contType.ID, Label: contType.Title };
			});
			control.Options.OnChanged = (_, formControl) => {
				this.contentType = ContentType.get(formControl.value);
				const expressionControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExpressionID"));
				expressionControl.Options.LookupOptions.ModalOptions.ComponentProps.filters = { Or: [
					{ ContentTypeDefinitionID: { Equals: this.contentType.ContentTypeDefinitionID } },
					{ RepositoryEntityID: { Equals: this.contentType.ID } }
				]};
			};
		}
		else if (AppUtility.isNotEmpty(this.portlet.ID)) {
			control.Hidden = true;
			this.contentType = ContentType.get(this.portlet.RepositoryEntityID);
			AppUtility.insertAt(
				formConfig,
				{
					Name: "RepositoryEntity",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: this.contentType.Title },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => ctrl.Name === control.Name)
			);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OriginalPortletID"));
		if (!this.isAdvancedMode) {
			control.Hidden = true;
		}

		const commonSettingsConfig = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CommonSettings")).SubControls.Controls;
		control = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => formControl.setValue(await this.portalsCoreSvc.getTemplateAsync("portlet.xml"))
		};

		control = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "TitleUISettings"));
		control.Options.Label = control.Options.Label === undefined ? undefined : control.Options.Label.replace("portals.portlets.controls.CommonSettings.TitleUISettings", "portals.common.controls.UISettings");
		control.Options.Description = control.Options.Description === undefined ? undefined : control.Options.Description.replace("portals.portlets.controls.CommonSettings.TitleUISettings", "portals.common.controls.UISettings");
		control.Options.PlaceHolder = control.Options.PlaceHolder === undefined ? undefined : control.Options.PlaceHolder.replace("portals.portlets.controls.CommonSettings.TitleUISettings", "portals.common.controls.UISettings");
		control.SubControls.Controls.forEach(ctrl => {
			ctrl.Options.Label = ctrl.Options.Label === undefined ? undefined : ctrl.Options.Label.replace("portals.portlets.controls.CommonSettings.TitleUISettings", "portals.common.controls.UISettings");
			ctrl.Options.Description = ctrl.Options.Description === undefined ? undefined : ctrl.Options.Description.replace("portals.portlets.controls.CommonSettings.TitleUISettings", "portals.common.controls.UISettings");
			ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder === undefined ? undefined : ctrl.Options.PlaceHolder.replace("portals.portlets.controls.CommonSettings.TitleUISettings", "portals.common.controls.UISettings");
		});

		control = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentUISettings"));
		control.Options.Label = control.Options.Label === undefined ? undefined : control.Options.Label.replace("portals.portlets.controls.CommonSettings.ContentUISettings", "portals.common.controls.UISettings");
		control.Options.Description = control.Options.Description === undefined ? undefined : control.Options.Description.replace("portals.portlets.controls.CommonSettings.ContentUISettings", "portals.common.controls.UISettings");
		control.Options.PlaceHolder = control.Options.PlaceHolder === undefined ? undefined : control.Options.PlaceHolder.replace("portals.portlets.controls.CommonSettings.ContentUISettings", "portals.common.controls.UISettings");
		control.SubControls.Controls.forEach(ctrl => {
			ctrl.Options.Label = ctrl.Options.Label === undefined ? undefined : ctrl.Options.Label.replace("portals.portlets.controls.CommonSettings.ContentUISettings", "portals.common.controls.UISettings");
			ctrl.Options.Description = ctrl.Options.Description === undefined ? undefined : ctrl.Options.Description.replace("portals.portlets.controls.CommonSettings.ContentUISettings", "portals.common.controls.UISettings");
			ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder === undefined ? undefined : ctrl.Options.PlaceHolder.replace("portals.portlets.controls.CommonSettings.ContentUISettings", "portals.common.controls.UISettings");
		});

		const iconControl = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "IconURI"));
		iconControl.Extras.LookupDisplayValues = AppUtility.isObject(this.portlet.CommonSettings, true) && AppUtility.isNotEmpty(this.portlet.CommonSettings.IconURI)
			? [{ Value: this.portlet.CommonSettings.IconURI, Label: this.portlet.CommonSettings.IconURI }]
			: undefined;

		const titleBackgoundImageControl = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "TitleUISettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		titleBackgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(this.portlet.CommonSettings, true) && AppUtility.isObject(this.portlet.CommonSettings.TitleUISettings, true) && AppUtility.isNotEmpty(this.portlet.CommonSettings.TitleUISettings.BackgroundImageURI)
			? [{ Value: this.portlet.CommonSettings.TitleUISettings.BackgroundImageURI, Label: this.portlet.CommonSettings.TitleUISettings.BackgroundImageURI }]
			: undefined;

		const contentBackgoundImageControl = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentUISettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		contentBackgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(this.portlet.CommonSettings, true) && AppUtility.isObject(this.portlet.CommonSettings.ContentUISettings, true) && AppUtility.isNotEmpty(this.portlet.CommonSettings.ContentUISettings.BackgroundImageURI)
			? [{ Value: this.portlet.CommonSettings.ContentUISettings.BackgroundImageURI, Label: this.portlet.CommonSettings.ContentUISettings.BackgroundImageURI }]
			: undefined;

		iconControl.Options.LookupOptions = titleBackgoundImageControl.Options.LookupOptions = contentBackgoundImageControl.Options.LookupOptions = {
			AsModal: true,
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: FilesProcessorModalPage,
				ComponentProps: {
					mode: "select",
					fileOptions: this.fileOptions,
					allowSelect: true,
					multiple: false,
					handlers: { predicate: (attachment: AttachmentInfo) => attachment.isImage, onSelect: () => {} }
				},
				OnDismiss: (attachments: AttachmentInfo[], formControl: AppFormsControlComponent) => {
					const uri = attachments !== undefined && attachments.length > 0 ? attachments[0].URIs.Direct : undefined;
					if (uri !== undefined) {
						formControl.setValue(uri);
						formControl.lookupDisplayValues = [{ Value: uri, Label: uri }];
					}
					else {
						formControl.setValue(undefined);
						formControl.lookupDisplayValues = undefined;
					}
				}
			}
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings"));
		control.Options.Label = control.Options.Description = undefined;
		const listSettingsConfig = control.SubControls.Controls;

		control = listSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"));
		control.Options.Rows = 18;
		control.Hidden = !this.isAdvancedMode;

		control = listSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => formControl.setValue(await this.portalsCoreSvc.getTemplateAsync("list.xsl", this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType.getObjectName(false)))
		};

		let expression = AppUtility.isObject(this.portlet.ListSettings, true) && AppUtility.isNotEmpty(this.portlet.ListSettings.ExpressionID)
			? Expression.get(this.portlet.ListSettings.ExpressionID)
			: undefined;
		if (expression === undefined && AppUtility.isObject(this.portlet.ListSettings, true) && AppUtility.isNotEmpty(this.portlet.ListSettings.ExpressionID)) {
			await this.portalsCoreSvc.getExpressionAsync(this.portlet.ListSettings.ExpressionID, _ => expression = Expression.get(this.portlet.ListSettings.ExpressionID), undefined, true);
		}

		control = listSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExpressionID"));
		control.Extras = { LookupDisplayValues: expression !== undefined ? [{ Value: expression.ID, Label: expression.Title }] : undefined };
		this.portalsCoreSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.contentType, true, false, options => {
			options.OnDelete = (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			};
			options.ModalOptions.OnDismiss = (data, formControl) => {
				if (AppUtility.isArray(data, true) && data[0].ID !== formControl.value) {
					const exp = Expression.get(data[0].ID);
					formControl.setValue(exp.ID);
					formControl.lookupDisplayValues = [{ Value: exp.ID, Label: exp.Title }];
				}
			};
			options.ModalOptions.ComponentProps.objectName = "expression";
			options.ModalOptions.ComponentProps.contentTypeID = undefined;
			options.ModalOptions.ComponentProps.sortBy = { Title: "Ascending" };
			if (this.contentType !== undefined) {
				options.ModalOptions.ComponentProps.filters = { Or: [
					{ ContentTypeDefinitionID: { Equals: this.contentType.ContentTypeDefinitionID } },
					{ RepositoryEntityID: { Equals: this.contentType.ID } }
				]};
			}
			options.ModalOptions.ComponentProps.preProcess = (expressions: Array<any>) => (expressions || []).forEach(exp => Expression.update(exp));
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ViewSettings"));
		control.Options.Label = control.Options.Description = undefined;
		const viewSettingsConfig = control.SubControls.Controls;

		control = viewSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"));
		control.Options.Rows = 18;
		control.Hidden = !this.isAdvancedMode;

		control = viewSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => formControl.setValue(await this.portalsCoreSvc.getTemplateAsync("view.xsl", this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType.getObjectName(false)))
		};

		const paginationSettingsConfig = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "PaginationSettings")).SubControls.Controls;
		control = paginationSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => formControl.setValue(await this.portalsCoreSvc.getTemplateAsync("pagination.xsl"))
		};

		const breadcrumbSettingsConfig = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "BreadcrumbSettings")).SubControls.Controls;
		control = breadcrumbSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => formControl.setValue(await this.portalsCoreSvc.getTemplateAsync("breadcrumb.xsl"))
		};

		formConfig.push(
			this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label"), false, true, true, FilesProcessorModalPage),
			this.portalsCoreSvc.getUploadFormControl(this.fileOptions, "attachments"),
		);

		if (AppUtility.isNotEmpty(this.portlet.ID)) {
			formConfig.push(
				this.portalsCoreSvc.getAuditFormControl(this.portlet, "common"),
				this.appFormsSvc.getButtonControls(
					"common",
					{
						Name: "Delete",
						Label: "{{portals.portlets.update.buttons.delete}}",
						OnClick: async () => await this.deleteAsync(),
						Options: {
							Fill: "clear",
							Color: "danger",
							Css: "ion-float-end",
							Icon: {
								Name: "trash",
								Slot: "start"
							}
						}
					}
				)
			);
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.portlet.ID)) {
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

	private get fileOptions() {
		return {
			ServiceName: this.portalsCoreSvc.name,
			ObjectName: "Desktop",
			SystemID: this.organization.ID,
			RepositoryEntityID: this.desktop.getEntityInfo("Desktop"),
			ObjectID: this.desktop.ID,
			ObjectTitle: this.desktop.Title,
			IsShared: false,
			IsTracked: this.organization.TrackDownloadFiles,
			IsTemporary: false,
			Extras: {}
		} as FileOptions;
	}

	onFormInitialized() {
		this.form.patchValue(this.portlet);
		if (AppUtility.isNotEmpty(this.portlet.ID)) {
		}
		else {
		}
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync();
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const portlet = this.form.value;
				portlet.RepositoryEntityID = AppUtility.isNotEmpty(portlet.RepositoryEntityID) && portlet.RepositoryEntityID !== "-" ? portlet.RepositoryEntityID : undefined;
				/*
				try {
					portlet.Filter = AppUtility.isNotEmpty(portlet.Filter)
						? JSON.parse(portlet.Filter)
						:
						{
							Operator: "And",
							Children: [{
								Attribute: "SystemID",
								Operator: "Equals",
								Value: this.organization.ID
							}]
						};
					portlet.Sorts = AppUtility.isNotEmpty(portlet.Sorts)
						? JSON.parse(portlet.Sorts)
						:
						[{
							Attribute: "Created",
							Mode: "Descending",
							ThenBy: undefined
						}];
				}
				catch (error) {
					this.processing = false;
					console.error("Error occurred while parsing JSON of portlets", error);
					await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.portlets.update.messages.json")});
					return;
				}
				*/

				if (AppUtility.isNotEmpty(portlet.ID)) {
					await this.portalsCoreSvc.updatePortletAsync(
						portlet,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Portlet", Type: "Updated", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.portlets.update.messages.success.update")),
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
					await this.portalsCoreSvc.createPortletAsync(
						portlet,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Portlet", Type: "Created", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.portlets.update.messages.success.new")),
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

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.portlets.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.portlets.update.buttons.delete"));
				await this.portalsCoreSvc.deletePortletAsync(
					this.portlet.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Portlet", Type: "Deleted", ID: data.ID });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.portlets.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.portlets.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.showErrorAsync(error)
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.portlets.update.messages.confirm.${AppUtility.isNotEmpty(this.portlet.ID) ? "cancel" : "new"}`),
			undefined,
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
