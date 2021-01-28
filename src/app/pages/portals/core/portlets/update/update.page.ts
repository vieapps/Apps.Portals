import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService, AppFormsLookupValue } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService, FileOptions } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { AttachmentInfo } from "@app/models/base";
import { Organization, ContentType, Expression, Desktop, Portlet } from "@app/models/portals.core.all";
import { DesktopsSelectorModalPage } from "@app/controls/portals/desktop.selector.modal.page";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { DataLookupModalPage } from "@app/controls/portals/data.lookup.modal.page";

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

	private organization: Organization;
	private contentType: ContentType;
	private desktop: Desktop;
	private originalDesktop: Desktop;
	private otherDesktops: Array<string>;
	private portlet: Portlet;
	private originalPortlet: Portlet;
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
	buttons = {
		save: "Save",
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
					{ And: [{ DesktopID: { Equals: this.desktop.ID } }] },
					{ Zone: "Ascending", OrderIndex: "Ascending" },
					{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
				);
				await this.portalsCoreSvc.searchPortletAsync(request, data => this.desktop.portlets = (data as Array<any>).map(portlet => Portlet.get(portlet.ID) || Portlet.deserialize(portlet, Portlet.get(portlet.ID))), undefined, true, true);
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
			this.isAdvancedMode = this.canModerateOrganization;
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
				SeparatedLabel: ">",
				HomeLabel: "Home",
				ShowModuleLink: false,
				ShowContentTypeLink: false
			};
		}
		else {
			this.isAdvancedMode = this.canModerateOrganization && AppUtility.isTrue(this.configSvc.requestParams["Advanced"]);
			if (AppUtility.isNotEmpty(this.portlet.OriginalPortletID)) {
				this.originalPortlet = Portlet.get(this.portlet.OriginalPortletID);
				if (this.originalPortlet === undefined) {
					await this.portalsCoreSvc.getPortletAsync(this.portlet.OriginalPortletID, _ => this.originalPortlet = Portlet.get(this.portlet.OriginalPortletID), undefined, true);
				}
				if (this.originalPortlet !== undefined) {
					if (this.originalPortlet.otherDesktops === undefined) {
						await this.portalsCoreSvc.getPortletAsync(this.originalPortlet.ID, _ => this.originalPortlet = Portlet.get(this.originalPortlet.ID), undefined, true);
						(this.originalPortlet.otherDesktops || []).forEach(id => {
							if (!Desktop.contains(id)) {
								this.portalsCoreSvc.getDesktopAsync(id);
							}
						});
					}
					this.originalDesktop = Desktop.get(this.originalPortlet.DesktopID);
					if (this.originalDesktop === undefined) {
						await this.portalsCoreSvc.getDesktopAsync(this.originalPortlet.DesktopID, _ => this.originalDesktop = Desktop.get(this.originalPortlet.DesktopID), undefined, true);
					}
				}
			}
			else {
				this.portlet.CommonSettings.TitleUISettings = this.portlet.CommonSettings.TitleUISettings || {};
				this.portlet.CommonSettings.ContentUISettings = this.portlet.CommonSettings.ContentUISettings || {};
				if (this.portlet.otherDesktops === undefined) {
					await this.portalsCoreSvc.getPortletAsync(this.portlet.ID, _ => this.portlet = Portlet.get(this.portlet.ID), undefined, true);
					(this.portlet.otherDesktops || []).forEach(id => {
						if (!Desktop.contains(id)) {
							this.portalsCoreSvc.getDesktopAsync(id);
						}
					});
				}
			}
			const contentTypeID = this.originalPortlet !== undefined ? this.originalPortlet.RepositoryEntityID : this.portlet.RepositoryEntityID;
			this.contentType = ContentType.get(contentTypeID);
			if (this.contentType === undefined && AppUtility.isNotEmpty(contentTypeID)) {
				await this.portalsCoreSvc.getContentTypeAsync(contentTypeID, _ => this.contentType = ContentType.get(contentTypeID), undefined, true);
			}
			this.otherDesktops = this.originalPortlet !== undefined ? this.originalPortlet.otherDesktops : this.portlet.otherDesktops;
			this.otherDesktops = (this.otherDesktops || []).map(id => id);
			if (this.originalPortlet !== undefined) {
				this.otherDesktops = this.otherDesktops.concat([this.portlet.DesktopID]);
			}
			this.otherDesktops = this.otherDesktops.distinct();
		}

		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.portlet.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.portlets.title.${(AppUtility.isNotEmpty(this.portlet.ID) ? "update" : "create")}`);
		this.buttons = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.portlet.ID) ? "save" : "create")}`),
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

		if (this.configSvc.isDebug) {
			console.log(`Update a portlet (${this.portlet.Title} - Mapping: ${this.originalPortlet !== undefined})`, this.portlet, this.originalPortlet);
		}
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("common", await this.configSvc.getResourceAsync("portals.portlets.update.segments.common")),
			new AppFormsSegment("list", await this.configSvc.getResourceAsync("portals.portlets.update.segments.list")),
			new AppFormsSegment("view", await this.configSvc.getResourceAsync("portals.portlets.update.segments.view")),
			new AppFormsSegment("other", await this.configSvc.getResourceAsync("portals.portlets.update.segments.other")),
			new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment"))
		];

		if (AppUtility.isNotEmpty(this.portlet.ID) && !this.isAdvancedMode) {
			const segments = this.contentType === undefined
				? ["list", "view", "other"]
				: this.contentType.contentTypeDefinition.NestedObject
					? ["view", "other"]
					: [];
			segments.forEach(segment => formSegments.removeAt(formSegments.findIndex(formSegment => formSegment.Name === segment)));
		}

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
		control.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AlternativeAction"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = ["List", "View"].map(action => {
			return { Value: action, Label: `{{portals.portlets.actions.${action}}}` };
		});
		control.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "DesktopID"));
		if (this.originalPortlet === undefined) {
			control.Type = "Lookup";
			control.Extras = { LookupDisplayValues: [{ Value: this.desktop.ID, Label: this.desktop.FullTitle }] };
			control.Options.Disabled = AppUtility.isNotEmpty(this.portlet.OriginalPortletID);
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
			formConfig.insert({
				Name: "Desktop",
				Type: "Text",
				Segment: control.Segment,
				Extras: { Text: `${this.organization.Title} :: ${this.originalDesktop.FullTitle}` },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}

		const otherDekstops = new Array<AppFormsLookupValue>();
		if (AppUtility.isNotEmpty(this.portlet.ID)) {
			await Promise.all(this.otherDesktops.map(async id => {
				let otherDesktop = Desktop.get(id);
				if (otherDesktop === undefined) {
					await this.portalsCoreSvc.getDesktopAsync(id, _ => otherDesktop = Desktop.get(id), undefined, true);
				}
				if (otherDesktop !== undefined) {
					otherDekstops.push({ Value: otherDesktop.ID, Label: otherDesktop.FullTitle });
				}
			}));
		}

		formConfig.insert({
			Name: "OtherDesktops",
			Type: "Lookup",
			Segment: control.Segment,
			Extras: { LookupDisplayValues: otherDekstops.length > 0 ? otherDekstops.sortBy("Label") : undefined },
			Options: {
				Label: control.Options.Label.replace("DesktopID", "OtherDesktops"),
				Description: control.Options.Description.replace("DesktopID", "OtherDesktops"),
				Disabled: this.originalPortlet !== undefined,
				LookupOptions: {
					Multiple: true,
					OnDelete: (data, formControl) => {
						const lookupDisplayValues = formControl.lookupDisplayValues;
						data.forEach(id => lookupDisplayValues.removeAt(lookupDisplayValues.findIndex(item => item.Value === id)));
						formControl.setValue(lookupDisplayValues.sortBy("Label").map(item => item.Value));
						formControl.lookupDisplayValues = lookupDisplayValues;
					},
					ModalOptions: {
						Component: DesktopsSelectorModalPage,
						ComponentProps: {
							multiple: true,
							organizationID: this.organization.ID
						},
						OnDismiss: async (data, formControl) => {
							if (AppUtility.isArray(data, true)) {
								const lookupDisplayValues = formControl.lookupDisplayValues;
								const currentDesktopID = this.formControls.find(ctrl => ctrl.Name === "DesktopID").value;
								(data as Array<string>).filter(id => id !== currentDesktopID).forEach(id => {
									const otherDesktop = Desktop.get(id);
									if (otherDesktop !== undefined && lookupDisplayValues.findIndex(item => item.Value === otherDesktop.ID) < 0) {
										lookupDisplayValues.push({ Value: otherDesktop.ID, Label: otherDesktop.FullTitle });
									}
								});
								formControl.setValue(lookupDisplayValues.sortBy("Label").map(item => item.Value));
								formControl.lookupDisplayValues = lookupDisplayValues;
							}
						}
					}
				}
			}
		}, formConfig.findIndex(ctrl => ctrl.Name === control.Name) + 1);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Zone"));
		if (AppUtility.isNotEmpty(this.portlet.ID) && !this.isAdvancedMode) {
			control.Hidden = true;
			formConfig.insert({
				Name: "ZoneName",
				Type: "Text",
				Segment: control.Segment,
				Extras: { Text: this.portlet.Zone },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}
		else {
			control.Options.SelectOptions.Interface = "popover";
			control.Options.SelectOptions.Values = (await this.portalsCoreSvc.getTemplateZonesAsync(this.originalDesktop !== undefined ? this.originalDesktop.ID : this.desktop.ID)).map(zone => {
				return { Value: zone, Label: zone };
			});
			control.Options.Disabled = AppUtility.isNotEmpty(this.portlet.OriginalPortletID);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryEntityID"));
		if (this.isAdvancedMode || AppUtility.isEmpty(this.portlet.ID)) {
			control.Options.SelectOptions.Values = this.organization.contentTypes.filter(contentType => contentType.contentTypeDefinition.Portlets).map(contentType => {
				return { Value: contentType.ID, Label: contentType.Title };
			});
			control.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);
			control.Options.OnChanged = (_, formControl) => {
				if (!AppUtility.isEquals(formControl.value, "-")) {
					const expressionControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExpressionID"));
					this.contentType = ContentType.get(formControl.value);
					if (this.contentType !== undefined) {
						expressionControl.Options.LookupOptions.ModalOptions.ComponentProps.filters = {
							And: [
								{
									SystemID: {
										Equals: this.contentType.SystemID
									}
								},
								{
									RepositoryID: {
										Equals: this.contentType.RepositoryID
									}
								},
								{
									Or: [
										{ ContentTypeDefinitionID: { Equals: this.contentType.ContentTypeDefinitionID } },
										{ RepositoryEntityID: { Equals: this.contentType.ID } }
									]
								}
							]
						};
						expressionControl.Options.LookupOptions.ModalOptions.ComponentProps.organizationID = this.contentType.SystemID;
						expressionControl.Options.LookupOptions.ModalOptions.ComponentProps.moduleID = this.contentType.RepositoryID;
						expressionControl.Options.LookupOptions.ModalOptions.ComponentProps.contentTypeID = this.contentType.ID;
					}
					expressionControl.controlRef.setValue(undefined);
					let settingsControl = this.formControls.find(ctrl => ctrl.Name === "ListSettings");
					if (settingsControl !== undefined) {
						let name = "list.xsl";
						if (this.contentType !== undefined && this.contentType.contentTypeDefinition !== undefined && this.contentType.contentTypeDefinition.NestedObject) {
							let options = settingsControl.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options")).value;
							options = typeof options === "string" ? JSON.parse(options) : options || {};
							if (AppUtility.isEquals("Menu", options.DisplayMode) || AppUtility.isTrue(options.AsMenu) || AppUtility.isTrue(options.ShowAsMenu) || AppUtility.isTrue(options.GenerateAsMenu)) {
								name = "menu.xsl";
							}
							else if (AppUtility.isEquals("Banner", options.DisplayMode) || AppUtility.isTrue(options.AsBanner) || AppUtility.isTrue(options.ShowAsBanner) || AppUtility.isTrue(options.GenerateAsBanner)) {
								name = "banner.xsl";
							}
						}
						this.portalsCoreSvc.setTemplateControlOptions(settingsControl.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), name, this.portalsCoreSvc.getTheme(this.portlet), this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType.getObjectName(false));
						settingsControl.SubControls.Controls.find(ctrl => ctrl.Name === "PageSize").controlRef.setValue(this.contentType.contentTypeDefinition.NestedObject ? 0 : this.portlet.ListSettings.PageSize);
					}
					settingsControl = this.formControls.find(ctrl => ctrl.Name === "ViewSettings");
					if (settingsControl !== undefined) {
						this.portalsCoreSvc.setTemplateControlOptions(settingsControl.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "view.xsl", this.portalsCoreSvc.getTheme(this.portlet), this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType.getObjectName(false));
					}
				}
			};
			control.Options.Disabled = AppUtility.isNotEmpty(this.portlet.OriginalPortletID);
		}
		else if (AppUtility.isNotEmpty(this.portlet.ID)) {
			control.Hidden = true;
			formConfig.insert({
				Name: "RepositoryEntity",
				Type: "Text",
				Segment: control.Segment,
				Extras: { Text: this.contentType !== undefined ? this.contentType.Title : this.unspecified },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OriginalPortletID"));
		if (AppUtility.isNotEmpty(this.portlet.ID) && AppUtility.isNotEmpty(this.portlet.OriginalPortletID)) {
			control.Options.ReadOnly = true;
			formConfig.insert({
				Name: "OriginalPortlet",
				Type: "Text",
				Segment: control.Segment,
				Extras: { Text: this.originalPortlet !== undefined ? (this.originalPortlet.desktop !== undefined ? `${this.originalPortlet.desktop.FullTitle} :: ` : "") + this.originalPortlet.Title : this.unspecified },
				Options: {
					Label: control.Options.Label.replace("OriginalPortletID", "OriginalPortlet"),
					Description: control.Options.Description.replace("OriginalPortletID", "OriginalPortlet"),
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}
		else {
			control.Hidden = true;
		}

		const expressionID = this.originalPortlet !== undefined ? this.originalPortlet.ExpressionID : this.portlet.ExpressionID;
		let expression = AppUtility.isNotEmpty(expressionID)
			? Expression.get(expressionID)
			: undefined;
		if (expression === undefined && AppUtility.isNotEmpty(expressionID)) {
			await this.portalsCoreSvc.getExpressionAsync(expressionID, _ => expression = Expression.get(expressionID), undefined, true);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExpressionID"));
		control.Extras = { LookupDisplayValues: expression !== undefined ? [{ Value: expression.ID, Label: expression.Title }] : undefined };
		this.portalsCoreSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.contentType, false, false, options => {
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

		const commonSettings = this.originalPortlet !== undefined ? this.originalPortlet.CommonSettings : this.portlet.CommonSettings;
		const listSettings = this.originalPortlet !== undefined ? this.originalPortlet.ListSettings : this.portlet.ListSettings;
		const viewSettings = this.originalPortlet !== undefined ? this.originalPortlet.ViewSettings : this.portlet.ViewSettings;

		const commonSettingsConfig = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CommonSettings")).SubControls.Controls;
		this.portalsCoreSvc.setTemplateControlOptions(commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "portlet.xml", this.portalsCoreSvc.getTheme(this.portlet));

		control = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "TitleUISettings"));
		this.portalsCoreSvc.setUISettingsControlOptions(control, "portals.portlets.controls.CommonSettings.TitleUISettings", this.fileOptions);
		control.Options.Label = "{{portals.portlets.controls.CommonSettings.TitleUISettings}}";

		const titleBackgoundImageControl = control.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		titleBackgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(commonSettings, true) && AppUtility.isObject(commonSettings.TitleUISettings, true) && AppUtility.isNotEmpty(commonSettings.TitleUISettings.BackgroundImageURI)
			? [{ Value: commonSettings.TitleUISettings.BackgroundImageURI, Label: commonSettings.TitleUISettings.BackgroundImageURI }]
			: undefined;

		control = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentUISettings"));
		this.portalsCoreSvc.setUISettingsControlOptions(control, "portals.portlets.controls.CommonSettings.ContentUISettings", this.fileOptions);
		control.Options.Label = "{{portals.portlets.controls.CommonSettings.ContentUISettings}}";

		const contentBackgoundImageControl = control.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		contentBackgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(commonSettings, true) && AppUtility.isObject(commonSettings.ContentUISettings, true) && AppUtility.isNotEmpty(commonSettings.ContentUISettings.BackgroundImageURI)
			? [{ Value: commonSettings.ContentUISettings.BackgroundImageURI, Label: commonSettings.ContentUISettings.BackgroundImageURI }]
			: undefined;

		const iconControl = commonSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "IconURI"));
		iconControl.Options.LookupOptions = titleBackgoundImageControl.Options.LookupOptions;
		iconControl.Extras.LookupDisplayValues = AppUtility.isObject(commonSettings, true) && AppUtility.isNotEmpty(commonSettings.IconURI)
			? [{ Value: commonSettings.IconURI, Label: commonSettings.IconURI }]
			: undefined;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ListSettings"));
		control.Options.Label = control.Options.Description = undefined;

		let xslName = "list.xsl";
		if (this.contentType !== undefined && this.contentType.contentTypeDefinition !== undefined && this.contentType.contentTypeDefinition.NestedObject) {
			const options = listSettings.Options || {};
			if (AppUtility.isEquals("Menu", options.DisplayMode) || AppUtility.isTrue(options.AsMenu) || AppUtility.isTrue(options.ShowAsMenu) || AppUtility.isTrue(options.GenerateAsMenu)) {
				xslName = "menu.xsl";
			}
			else if (AppUtility.isEquals("Banner", options.DisplayMode) || AppUtility.isTrue(options.AsBanner) || AppUtility.isTrue(options.ShowAsBanner) || AppUtility.isTrue(options.GenerateAsBanner)) {
				xslName = "banner.xsl";
			}
		}

		const listSettingsConfig = control.SubControls.Controls;
		this.portalsCoreSvc.setTemplateControlOptions(listSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), xslName, this.portalsCoreSvc.getTheme(this.portlet), this.contentType === undefined ? undefined : this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType === undefined ? undefined : this.contentType.getObjectName(false));

		control = listSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"));
		control.Options.Rows = 18;
		if (AppUtility.isNotEmpty(this.portlet.ID)) {
			if (!this.isAdvancedMode) {
				control.Hidden = true;
				listSettingsConfig.insert({
					Name: "ListOptions",
					Type: "Text",
					Extras: { Text: AppUtility.isObject(listSettings, true) && AppUtility.isObject(listSettings.Options, true) ? JSON.stringify(listSettings.Options) : undefined },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true,
						Type: "textarea",
						Rows: 18
					}
				}, listSettingsConfig.findIndex(ctrl => ctrl.Name === control.Name));
			}
		}
		else {
			control.Hidden = !this.isAdvancedMode;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ViewSettings"));
		control.Options.Label = control.Options.Description = undefined;

		const viewSettingsConfig = control.SubControls.Controls;
		this.portalsCoreSvc.setTemplateControlOptions(viewSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "view.xsl", this.portalsCoreSvc.getTheme(this.portlet), this.contentType === undefined ? undefined : this.contentType.contentTypeDefinition.ModuleDefinition.Directory, this.contentType === undefined ? undefined : this.contentType.getObjectName(false));

		control = viewSettingsConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Options"));
		control.Options.Rows = 18;
		if (AppUtility.isNotEmpty(this.portlet.ID)) {
			if (!this.isAdvancedMode) {
				control.Hidden = true;
				viewSettingsConfig.insert({
					Name: "ViewOptions",
					Type: "Text",
					Extras: { Text: AppUtility.isObject(viewSettings, true) && AppUtility.isObject(viewSettings.Options, true) ? JSON.stringify(viewSettings.Options) : undefined },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true,
						Type: "textarea",
						Rows: 18
					}
				}, viewSettingsConfig.findIndex(ctrl => ctrl.Name === control.Name));
			}
		}
		else {
			control.Hidden = !this.isAdvancedMode;
		}

		this.portalsCoreSvc.setTemplateControlOptions(formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "PaginationSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "pagination.xml", this.portalsCoreSvc.getTheme(this.portlet));
		this.portalsCoreSvc.setTemplateControlOptions(formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "BreadcrumbSettings")).SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template")), "breadcrumb.xml", this.portalsCoreSvc.getTheme(this.portlet));

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
			if (!this.isAdvancedMode) {
				const segments = this.contentType === undefined
					? ["list", "view", "other"]
					: this.contentType.contentTypeDefinition.NestedObject
						? ["view", "other"]
						: [];
				segments.forEach(segment => formConfig.filter(ctrl => ctrl.Segment === segment).forEach(ctrl => ctrl.Hidden = true));
			}
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
			ObjectID: this.originalDesktop !== undefined ? this.originalDesktop.ID : this.desktop.ID,
			ObjectTitle: this.originalDesktop !== undefined ? this.originalDesktop.Title : this.desktop.Title,
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
		const portlet = AppUtility.clone(this.originalPortlet !== undefined ? this.originalPortlet : this.portlet);
		portlet.ID = this.portlet.ID;
		portlet.OriginalPortletID = this.originalPortlet !== undefined ? this.originalPortlet.ID : undefined;
		portlet.DesktopID = this.originalPortlet !== undefined ? this.originalPortlet.DesktopID : this.portlet.DesktopID;
		portlet.OtherDesktops = this.otherDesktops;

		if (AppUtility.isNotEmpty(portlet.ID) && !this.isAdvancedMode) {
			if (this.contentType === undefined) {
				portlet.Action = portlet.AlternativeAction = undefined;
				this.formControls.find(ctrl => ctrl.Name === "Action").Options.Disabled = this.formControls.find(ctrl => ctrl.Name === "AlternativeAction").Options.Disabled = true;
			}
			else if (this.contentType.contentTypeDefinition.NestedObject) {
				portlet.Action = "List";
				portlet.AlternativeAction = undefined;
				this.formControls.find(ctrl => ctrl.Name === "Action").Options.Disabled = this.formControls.find(ctrl => ctrl.Name === "AlternativeAction").Options.Disabled = true;
				portlet.ListSettings.AutoPageNumber = false;
				portlet.ListSettings.ShowBreadcrumbs = false;
				portlet.ListSettings.ShowPagination = false;
				const control = this.formControls.find(ctrl => ctrl.Name === "ListSettings");
				control.SubControls.Controls.find(ctrl => ctrl.Name === "AutoPageNumber").Options.Disabled = true;
				control.SubControls.Controls.find(ctrl => ctrl.Name === "ShowBreadcrumbs").Options.Disabled = true;
				control.SubControls.Controls.find(ctrl => ctrl.Name === "ShowPagination").Options.Disabled = true;
			}
		}
		this.form.patchValue(portlet);
		this.form.controls.Action.setValue(portlet.Action === undefined ? "-" : portlet.Action);
		this.form.controls.AlternativeAction.setValue(portlet.AlternativeAction === undefined ? "-" : portlet.AlternativeAction);
		this.form.controls.RepositoryEntityID.setValue(portlet.RepositoryEntityID === undefined ? "-" : portlet.RepositoryEntityID);
		if (this.isAdvancedMode) {
			(this.form.controls.ListSettings as FormGroup).controls.Options.setValue(AppUtility.isObject(portlet.ListSettings, true) && AppUtility.isObject(portlet.ListSettings.Options, true) ? JSON.stringify(portlet.ListSettings.Options) : undefined);
			(this.form.controls.ViewSettings as FormGroup).controls.Options.setValue(AppUtility.isObject(portlet.ViewSettings, true) && AppUtility.isObject(portlet.ViewSettings.Options, true) ? JSON.stringify(portlet.ViewSettings.Options) : undefined);
		}
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(async () => {
			await this.filesSvc.searchAttachmentsAsync(this.fileOptions, attachments => this.prepareAttachments(attachments));
			this.hash = AppCrypto.hash(this.form.value);
		});
		if (this.configSvc.isDebug) {
			console.log("<Portals>: Portlet", this.portlet);
		}
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

	async saveAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const portlet = this.form.value;
				let options = AppUtility.isObject(portlet.ListSettings, true)
					? portlet.ListSettings.Options
					: undefined;
				if (AppUtility.isNotEmpty(options)) {
					try {
						portlet.ListSettings.Options = JSON.stringify(JSON.parse(options));
					}
					catch (error) {
						this.processing = false;
						console.error("Error occurred while parsing JSON of list settings", error);
						await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.portlets.update.messages.json") }, undefined, _ => {
							const control = this.formControls.find(ctrl => ctrl.Name === "ListSettings").SubControls.Controls.find(ctrl => ctrl.Name === "Options");
							this.formSegments.current = control.Segment;
							control.focus();
						});
						return;
					}
				}
				else {
					portlet.ListSettings.Options = AppUtility.isObject(options, true)
						? JSON.stringify(options)
						: undefined;
				}
				options = AppUtility.isObject(portlet.ViewSettings, true)
					? portlet.ViewSettings.Options
					: undefined;
				if (AppUtility.isNotEmpty(options)) {
					try {
						portlet.ViewSettings.Options = JSON.stringify(JSON.parse(options));
					}
					catch (error) {
						this.processing = false;
						console.error("Error occurred while parsing JSON of view settings", error);
						await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.portlets.update.messages.json") }, undefined, _ => {
							const control = this.formControls.find(ctrl => ctrl.Name === "ViewSettings").SubControls.Controls.find(ctrl => ctrl.Name === "Options");
							this.formSegments.current = control.Segment;
							control.focus();
						});
						return;
					}
				}
				else {
					portlet.ViewSettings.Options = AppUtility.isObject(options, true)
						? JSON.stringify(options)
						: undefined;
				}

				if (this.contentType === undefined) {
					portlet.Action = portlet.AlternativeAction = portlet.RepositoryEntityID = undefined;
				}
				else if (this.contentType.contentTypeDefinition.NestedObject) {
					portlet.Action = "List";
					portlet.AlternativeAction = undefined;
					portlet.ListSettings.AutoPageNumber = false;
					portlet.ListSettings.ShowBreadcrumbs = false;
					portlet.ListSettings.ShowPagination = false;
				}
				else {
					portlet.Action = AppUtility.isEquals(portlet.Action, "-") ? undefined : portlet.Action;
					portlet.AlternativeAction = AppUtility.isEquals(portlet.AlternativeAction, "-") ? undefined : portlet.AlternativeAction;
					portlet.RepositoryEntityID = AppUtility.isEquals(portlet.RepositoryEntityID, "-") ? undefined : portlet.RepositoryEntityID;
				}

				if (AppUtility.isNotEmpty(portlet.ID)) {
					await this.portalsCoreSvc.updatePortletAsync(
						portlet,
						async data => {
							if (this.originalDesktop !== undefined && this.originalDesktop.portlets !== undefined) {
								this.originalDesktop.portlets[this.originalDesktop.portlets.findIndex(p => p.ID === data.ID)] = Portlet.get(data.ID);
							}
							else if (this.desktop !== undefined && this.desktop.portlets !== undefined) {
								this.desktop.portlets[this.desktop.portlets.findIndex(p => p.ID === data.ID)] = Portlet.get(data.ID);
							}
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
						},
						{
							"IsAdvancedMode": this.isAdvancedMode.toString()
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
						this.desktop.portlets.removeAt(this.desktop.portlets.findIndex(p => p.ID === data.ID));
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
		if (message === undefined && this.hash === AppCrypto.hash(this.form.value)) {
			await this.configSvc.navigateBackAsync();
		}
		else {
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

}
