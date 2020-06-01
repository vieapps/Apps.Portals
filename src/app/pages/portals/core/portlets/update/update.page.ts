import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppPagination } from "@components/app.pagination";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
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

export class PortalsPortletsUpdatePage implements OnInit, OnDestroy {
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
	private unspecified = "Unspecified";
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "common",
		current: "common"
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

	ngOnDestroy() {
		AppEvents.off(this.filesSvc.name, "Portlet:Refresh");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const desktopID = this.configSvc.requestParams["DesktopID"];
		this.desktop = Desktop.get(desktopID);
		if (this.desktop === undefined && AppUtility.isNotEmpty(desktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(desktopID, _ => this.desktop = Desktop.get(desktopID), undefined, true);
		}
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

		if (this.organization.contentTypes === undefined || this.organization.contentTypes.length < 1) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.contenttypes.list.no")));
			return;
		}

		if (this.portlet === undefined) {
			this.isAdvancedMode = this.isSystemModerator;
			this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"]) || this.organization.contentTypes.filter(contentType => contentType.contentTypeDefinition.Portlets)[0];
			this.portlet = new Portlet(this.desktop.SystemID, this.desktop.ID, this.contentType.ID);
			this.portlet.Action = "List";
			this.portlet.AlternativeAction = "View";
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
		}
		else {
			this.isAdvancedMode = this.isSystemModerator && AppUtility.isTrue(this.configSvc.requestParams["Advanced"]);
			this.portlet.CommonSettings.TitleUISettings = this.portlet.CommonSettings.TitleUISettings || {};
			this.portlet.CommonSettings.ContentUISettings = this.portlet.CommonSettings.ContentUISettings || {};
			this.contentType = ContentType.get(this.portlet.RepositoryEntityID);
			if (this.contentType === undefined && AppUtility.isNotEmpty(this.portlet.RepositoryEntityID)) {
				await this.portalsCoreSvc.getContentTypeAsync(this.portlet.RepositoryEntityID, _ => this.contentType = ContentType.get(this.portlet.RepositoryEntityID), undefined, true);
			}
		}

		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.portlet.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.portlets.title.${(AppUtility.isNotEmpty(this.portlet.ID) ? "update" : "create")}`);
		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.portlet.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};
		this.unspecified = await this.configSvc.getResourceAsync("portals.common.unspecified");

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();

		AppEvents.on(this.filesSvc.name, info => {
			if (info.args.Object === "Attachment" && this.desktop.ID === info.args.ObjectID) {
				this.prepareAttachments(undefined, info.args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(info.args.Data), info.args.Event === "Delete" ? this.filesSvc.prepareAttachment(info.args.Data) : undefined);
			}
		}, "Portlet:Refresh");
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Action"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = ["List", "View"].map(action => {
			return { Value: action, Label: `{{portals.portlets.actions.${action}}}` };
		});
		AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: "-", Label: this.unspecified }, 0);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AlternativeAction"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = ["List", "View"].map(action => {
			return { Value: action, Label: `{{portals.portlets.actions.${action}}}` };
		});
		AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: "-", Label: this.unspecified }, 0);

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
					OnDismiss: async (data, formControl) => {
						if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
							const selectedDesktop = Desktop.get(data[0]);
							formControl.setValue(selectedDesktop.ID);
							formControl.lookupDisplayValues = [{ Value: selectedDesktop.ID, Label: selectedDesktop.FullTitle }];
							const zonesControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Zone"));
							zonesControl.Options.SelectOptions.Values = (await this.portalsCoreSvc.getTemplateZonesAsync(selectedDesktop.ID)).map(zone => {
								return { Value: zone, Label: zone };
							});
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Zone"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = (await this.portalsCoreSvc.getTemplateZonesAsync(this.desktop.ID)).map(zone => {
			return { Value: zone, Label: zone };
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryEntityID"));
		if (this.isAdvancedMode) {
			control.Options.SelectOptions.Values = this.organization.contentTypes.filter(contentType => contentType.contentTypeDefinition.Portlets).map(contentType => {
				return { Value: contentType.ID, Label: contentType.Title };
			});
			AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: "-", Label: this.unspecified }, 0);
			control.Options.OnChanged = (_, formControl) => {
				if (!AppUtility.isEquals(formControl.value, "-")) {
					this.contentType = ContentType.get(formControl.value);
					const expressionControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExpressionID"));
					expressionControl.Options.LookupOptions.ModalOptions.ComponentProps.filters = { Or: [
						{ ContentTypeDefinitionID: { Equals: this.contentType.ContentTypeDefinitionID } },
						{ RepositoryEntityID: { Equals: this.contentType.ID } }
					]};
					this.portalsCoreSvc.setTemplateControlOptions(this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "list.xsl", this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType.getObjectName(false));
					this.portalsCoreSvc.setTemplateControlOptions(this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ViewSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "view.xsl", this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType.getObjectName(false));
				}
			};
		}
		else if (AppUtility.isNotEmpty(this.portlet.ID)) {
			control.Hidden = true;
			AppUtility.insertAt(
				formConfig,
				{
					Name: "RepositoryEntity",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: this.contentType !== undefined ? this.contentType.Title : this.unspecified },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => ctrl.Name === control.Name)
			);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OriginalPortletID"));
		if (AppUtility.isNotEmpty(this.portlet.ID)) {
			if (AppUtility.isNotEmpty(this.portlet.OriginalPortletID)) {
				let originalPortlet = Portlet.get(this.portlet.OriginalPortletID);
				if (originalPortlet === undefined) {
					await this.portalsCoreSvc.getPortletAsync(this.portlet.OriginalPortletID, _ => originalPortlet = Portlet.get(this.portlet.OriginalPortletID), undefined, true);
				}
				AppUtility.insertAt(
					formConfig,
					{
						Name: "OriginalPortlet",
						Type: "Text",
						Segment: "basic",
						Extras: { Text: originalPortlet !== undefined ? (originalPortlet.desktop !== undefined ? `${originalPortlet.desktop.FullTitle} :: ` : "") + originalPortlet.Title : this.unspecified },
						Options: {
							Label: control.Options.Label,
							ReadOnly: true
						}
					},
					formConfig.findIndex(ctrl => ctrl.Name === control.Name)
				);
			}
			else {
				control.Hidden = true;
			}
		}
		else {
			control.Hidden = !this.isAdvancedMode;
		}

		const commonSettingsConfig = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CommonSettings")).SubControls.Controls;
		this.portalsCoreSvc.setTemplateControlOptions(commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "portlet.xml");

		control = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "TitleUISettings"));
		this.portalsCoreSvc.setUISettingsControlOptions(control, "portals.portlets.controls.CommonSettings.TitleUISettings", this.fileOptions);
		control.Options.Label = "{{portals.portlets.controls.CommonSettings.TitleUISettings}}";

		const titleBackgoundImageControl = control.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		titleBackgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(this.portlet.CommonSettings, true) && AppUtility.isObject(this.portlet.CommonSettings.TitleUISettings, true) && AppUtility.isNotEmpty(this.portlet.CommonSettings.TitleUISettings.BackgroundImageURI)
			? [{ Value: this.portlet.CommonSettings.TitleUISettings.BackgroundImageURI, Label: this.portlet.CommonSettings.TitleUISettings.BackgroundImageURI }]
			: undefined;

		control = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentUISettings"));
		this.portalsCoreSvc.setUISettingsControlOptions(control, "portals.portlets.controls.CommonSettings.ContentUISettings", this.fileOptions);
		control.Options.Label = "{{portals.portlets.controls.CommonSettings.ContentUISettings}}";

		const contentBackgoundImageControl = control.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		contentBackgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(this.portlet.CommonSettings, true) && AppUtility.isObject(this.portlet.CommonSettings.ContentUISettings, true) && AppUtility.isNotEmpty(this.portlet.CommonSettings.ContentUISettings.BackgroundImageURI)
			? [{ Value: this.portlet.CommonSettings.ContentUISettings.BackgroundImageURI, Label: this.portlet.CommonSettings.ContentUISettings.BackgroundImageURI }]
			: undefined;

		const iconControl = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "IconURI"));
		iconControl.Options.LookupOptions = titleBackgoundImageControl.Options.LookupOptions;
		iconControl.Extras.LookupDisplayValues = AppUtility.isObject(this.portlet.CommonSettings, true) && AppUtility.isNotEmpty(this.portlet.CommonSettings.IconURI)
			? [{ Value: this.portlet.CommonSettings.IconURI, Label: this.portlet.CommonSettings.IconURI }]
			: undefined;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings"));
		control.Options.Label = control.Options.Description = undefined;

		const listSettingsConfig = control.SubControls.Controls;
		this.portalsCoreSvc.setTemplateControlOptions(listSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "list.xsl", this.contentType === undefined ? undefined : this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType === undefined ? undefined : this.contentType.getObjectName(false));

		control = listSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"));
		control.Options.Rows = 18;
		control.Hidden = !this.isAdvancedMode;

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
		this.portalsCoreSvc.setTemplateControlOptions(viewSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "view.xsl", this.contentType === undefined ? undefined : this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType === undefined ? undefined : this.contentType.getObjectName(false));

		control = viewSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"));
		control.Options.Rows = 18;
		control.Hidden = !this.isAdvancedMode;

		this.portalsCoreSvc.setTemplateControlOptions(formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "PaginationSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "pagination.xml");
		this.portalsCoreSvc.setTemplateControlOptions(formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "BreadcrumbSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "breadcrumb.xml");

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

	private prepareAttachments(attachments?: Array<AttachmentInfo>, addedOrUpdated?: AttachmentInfo, deleted?: AttachmentInfo, onCompleted?: (control: AppFormsControl) => void) {
		const formControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Attachments"));
		this.filesSvc.prepareAttachmentsFormControl(formControl, false, attachments, addedOrUpdated, deleted, onCompleted);
	}

	onFormInitialized() {
		this.form.patchValue(this.portlet);
		this.form.controls.Action.setValue(this.portlet.Action === undefined ? "-" : this.portlet.Action);
		this.form.controls.AlternativeAction.setValue(this.portlet.AlternativeAction === undefined ? "-" : this.portlet.AlternativeAction);
		this.form.controls.RepositoryEntityID.setValue(this.portlet.RepositoryEntityID === undefined ? "-" : this.portlet.RepositoryEntityID);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(async () => await this.filesSvc.searchAttachmentsAsync(this.fileOptions, attachments => this.prepareAttachments(attachments)));
	}

	private async showErrorAsync(error: any) {
		const templateIsInvalid = "TemplateIsInvalidException" === error.Type;
		const optionsAreInvalid = "OptionsAreInvalidException" === error.Type;
		const details = AppUtility.isNotEmpty(error.Message) ? error.Message as string : "";
		const subHeader = templateIsInvalid
			? details.indexOf("List XSLT") > -1
				? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.portlet.listXslt")
				: details.indexOf("View XSLT") > -1
						? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.portlet.viewXslt")
						: details.indexOf("Pagination XSLT") > -1
							? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.portlet.paginationXslt")
							: details.indexOf("Breadcrumb XSLT") > -1
								? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.portlet.breadcrumbXslt")
								: await this.appFormsSvc.getResourceAsync("portals.common.errors.template.portlet.invalid")
			: optionsAreInvalid
				? details.indexOf("List options") > -1
					? await this.appFormsSvc.getResourceAsync("portals.common.errors.listOptions")
					: await this.appFormsSvc.getResourceAsync("portals.common.errors.viewOptions")
				: undefined;
		await this.appFormsSvc.showErrorAsync(error, subHeader, () => {
			const control = templateIsInvalid
				? details.indexOf("List XSLT") > -1
					? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"))
					: details.indexOf("View XSLT") > -1
							? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ViewSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"))
							: details.indexOf("Pagination XSLT") > -1
								? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "PaginationSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"))
								: details.indexOf("Breadcrumb XSLT") > -1
									? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BreadcrumbSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"))
									: this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "CommonSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"))
				: optionsAreInvalid
					? details.indexOf("List options") > -1
						? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"))
						: this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ViewSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"))
					: undefined;
			if (control !== undefined) {
				this.formSegments.current = control.Segment || control.parent.Segment;
				control.focus();
			}
		});
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const listSettings = this.form.value.ListSettings;
				if (AppUtility.isObject(listSettings, true) && AppUtility.isNotEmpty(listSettings.Options)) {
					try {
						JSON.parse(listSettings.Options);
					}
					catch (error) {
						this.processing = false;
						console.error("Error occurred while parsing JSON of list settings", error);
						await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.portlets.update.messages.json")});
						return;
					}
				}

				const viewSettings = this.form.value.ViewSettings;
				if (AppUtility.isObject(viewSettings, true) && AppUtility.isNotEmpty(viewSettings.Options)) {
					try {
						JSON.parse(viewSettings.Options);
					}
					catch (error) {
						this.processing = false;
						console.error("Error occurred while parsing JSON of view settings", error);
						await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.portlets.update.messages.json")});
						return;
					}
				}

				const portlet = this.form.value;
				portlet.Action = AppUtility.isEquals(portlet.Action, "-") ? undefined : portlet.Action;
				portlet.AlternativeAction = AppUtility.isEquals(portlet.AlternativeAction, "-") ? undefined : portlet.AlternativeAction;
				portlet.RepositoryEntityID = AppUtility.isEquals(portlet.RepositoryEntityID, "-") ? undefined : portlet.RepositoryEntityID;

				if (AppUtility.isNotEmpty(portlet.ID)) {
					await this.portalsCoreSvc.updatePortletAsync(
						portlet,
						async data => {
							this.desktop.portlets[this.desktop.portlets.findIndex(p => p.ID === data.ID)] = Portlet.get(data.ID);
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Portlet", Type: "Updated", ID: data.ID, DekstopID: data.DekstopID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.portlets.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.showErrorAsync(error);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createPortletAsync(
						portlet,
						async data => {
							this.desktop.portlets = this.desktop.portlets || [];
							this.desktop.portlets.push(Portlet.get(data.ID));
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Portlet", Type: "Created", ID: data.ID, DekstopID: data.DekstopID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.portlets.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.showErrorAsync(error);
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
						AppUtility.removeAt(this.desktop.portlets, this.desktop.portlets.findIndex(p => p.ID === data.ID));
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Portlet", Type: "Deleted", ID: data.ID, DekstopID: data.DekstopID });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.portlets.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.portlets.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.showErrorAsync(error)
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
