import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService, AppFormsLookupValue } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Category } from "@models/portals.cms.category";
import { Content } from "@models/portals.cms.content";
import { DataLookupModalPage } from "@controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-cms-contents-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsContentsUpdatePage implements OnInit {

	constructor(
		public configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private category: Category;
	private content: Content;
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic",
		current: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		update: "Update",
		cancel: "Cancel"
	};

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		const contentID = this.configSvc.requestParams["ID"];
		if (AppUtility.isNotEmpty(contentID)) {
			this.content = Content.get(contentID);
			if (this.content === undefined) {
				await this.portalsCmsSvc.getContentAsync(contentID, _ => this.content = Content.get(contentID), undefined, true);
			}
		}

		this.contentType = this.content !== undefined
			? this.content.ContentType
			: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.content !== undefined
			? Organization.get(this.content.SystemID)
			: this.contentType !== undefined
				? Organization.get(this.contentType.SystemID)
				: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all");
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = this.content !== undefined
				? this.content.ContentType
				: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
			if (this.contentType === undefined) {
				await this.cancelAsync(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid"), "/portals/core/content.types/list/all");
				return;
			}
		}

		this.module = Module.get(this.contentType.RepositoryID);
		this.category = this.content !== undefined ? this.content.category : Category.get(this.configSvc.requestParams["CategoryID"]);

		let canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Content", this.category !== undefined ? this.category.Privileges : this.module.Privileges);
		if (!canUpdate && this.content !== undefined && (AppUtility.isEquals(this.content.Status, "Draft") || AppUtility.isEquals(this.content.Status, "Pending"))) {
			canUpdate = AppUtility.isEquals(this.content.CreatedID, this.configSvc.getAccount().id);
		}

		if (canUpdate) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
		this.content = this.content || new Content(this.organization.ID, this.module.ID, this.contentType.ID, this.category !== undefined ? this.category.ID : undefined, new Date());

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.cms.contents.title.${(AppUtility.isNotEmpty(this.content.ID) ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.content.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("management", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.management")),
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.basic")),
			new AppFormsSegment("related", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.related"))
		];
		if (AppUtility.isNotEmpty(this.content.ID)) {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.attachments")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const contentType = this.portalsCmsSvc.getDefaultContentTypeOfCategory(this.module);
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.content");

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		control.Options.SelectOptions.Interface = "popover";
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{status.approval.${value}}}` };
			});
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CategoryID"));
		control.Extras = { LookupDisplayValues: this.category !== undefined ? [{ Value: this.category.ID, Label: this.category.FullTitle }] : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, contentType, false, true, options => {
			options.OnDelete = (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			};
			options.ModalOptions.OnDismiss = async (data, formControl) => {
				if (AppUtility.isArray(data, true) && data[0].ID !== formControl.value) {
					const category = Category.get(data[0].ID);
					formControl.setValue(category.ID);
					formControl.lookupDisplayValues = [{ Value: category.ID, Label: category.FullTitle }];
				}
			};
			options.ModalOptions.ComponentProps.preProcess = (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories, true);
		});

		const otherCategories = new Array<AppFormsLookupValue>();
		if (AppUtility.isArray(this.content.OtherCategories, true)) {
			await Promise.all(this.content.OtherCategories.map(async id => {
				let category = Category.get(id);
				if (category === undefined) {
					await this.portalsCmsSvc.getCategoryAsync(id, undefined, undefined, true);
					category = Category.get(id);
				}
				if (category !== undefined) {
					otherCategories.push({ Value: category.ID, Label: category.FullTitle });
				}
			}));
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OtherCategories"));
		control.Extras = { LookupDisplayValues: otherCategories.length > 0 ? otherCategories : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, contentType, true, true, options => {
			options.OnDelete = (data, formControl) => {
				const lookupDisplayValues = formControl.lookupDisplayValues;
				data.forEach(id => AppUtility.removeAt(lookupDisplayValues, lookupDisplayValues.findIndex(item => item.Value === id)));
				formControl.setValue(lookupDisplayValues.map(item => item.Value));
				formControl.lookupDisplayValues = lookupDisplayValues;
			};
			options.ModalOptions.OnDismiss = (data, formControl) => {
				if (AppUtility.isArray(data, true)) {
					const lookupDisplayValues = formControl.lookupDisplayValues;
					(data as Array<any>).forEach(info => {
						const category = Category.get(info.ID);
						if (category !== undefined && lookupDisplayValues.findIndex(item => item.Value === category.ID) < 0) {
							lookupDisplayValues.push({ Value: category.ID, Label: category.FullTitle });
						}
					});
					formControl.setValue(lookupDisplayValues.map(item => item.Value));
					formControl.lookupDisplayValues = lookupDisplayValues;
				}
			};
			options.ModalOptions.ComponentProps.preProcess = (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories, true);
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "StartDate"));
		control.Required = true;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "EndDate"));
		control.Required = false;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "PublishedTime"));
		control.Required = false;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AllowComments"));
		control.Options.Type = "toggle";
		control.Hidden = !this.contentType.AllowComments;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "SourceURL"));
		control.Options.Icon = {
			Name: "globe",
			Fill: "clear",
			Color: "medium",
			Slot: "end",
			OnClick: (_, formControl) => PlatformUtility.openURI(formControl.value)
		};

		const linkSelectorOptions = {
			content: {
				label: await this.appFormsSvc.getResourceAsync("portals.cms.common.links.content"),
				sortBy: { StartDate: "Descending", PublishedTime: "Descending" },
				preProcess: (contents: Array<any>) => contents.forEach(data => {
					const content = Content.update(data);
					if (content.category === undefined) {
						this.portalsCmsSvc.getCategoryAsync(content.CategoryID, _ => {
							const category = Category.get(content.CategoryID);
							if (category !== undefined) {
								this.portalsCmsSvc.fetchDesktops(category);
							}
						});
					}
				})
			},
			file: {
				label: await this.appFormsSvc.getResourceAsync("portals.cms.common.links.label")
			}
		};

		formConfig.filter(ctrl => AppUtility.isEquals(ctrl.Type, "TextEditor")).forEach(ctrl => {
			ctrl.Extras["ckEditorLinkSelector"] = this.portalsCmsSvc.getLinkSelector(this.content, DataLookupModalPage, undefined, linkSelectorOptions);
			ctrl.Extras["ckEditorSimpleUpload"] = AppUtility.isNotEmpty(this.content.ID) ? this.portalsCmsSvc.getFileHeader(this.content) : undefined;
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Details"));
		control.Extras["ckEditorPageBreakIsAvailable"] = true;

		const relateds = new Array<AppFormsLookupValue>();
		if (AppUtility.isArray(this.content.Relateds, true)) {
			await Promise.all(this.content.Relateds.map(async id => {
				let content = Content.get(id);
				if (content === undefined) {
					await this.portalsCmsSvc.getContentAsync(id, undefined, undefined, true);
					content = Content.get(id);
				}
				if (content !== undefined) {
					relateds.push({ Value: content.ID, Label: content.Title });
				}
			}));
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Relateds"));
		control.Extras = { LookupDisplayValues: relateds.length > 0 ? relateds : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.contentType, true, false, options => {
			options.OnDelete = (data, formControl) => {
				const lookupDisplayValues = formControl.lookupDisplayValues;
				data.forEach(id => AppUtility.removeAt(lookupDisplayValues, lookupDisplayValues.findIndex(item => item.Value === id)));
				formControl.setValue(lookupDisplayValues.map(item => item.Value));
				formControl.lookupDisplayValues = lookupDisplayValues;
			};
			options.ModalOptions.OnDismiss = (data, formControl) => {
				if (AppUtility.isArray(data, true)) {
					const lookupDisplayValues = formControl.lookupDisplayValues;
					(data as Array<any>).forEach(info => {
						const content = Content.get(info.ID);
						if (content !== undefined && lookupDisplayValues.findIndex(item => item.Value === content.ID) < 0) {
							lookupDisplayValues.push({ Value: content.ID, Label: content.Title });
						}
					});
					formControl.setValue(lookupDisplayValues.map(item => item.Value));
					formControl.lookupDisplayValues = lookupDisplayValues;
				}
			};
			options.ModalOptions.ComponentProps.excludedIDs = AppUtility.isNotEmpty(this.content.ID) ? [this.content.ID] : undefined;
			options.ModalOptions.ComponentProps.sortBy = { StartDate: "Descending", PublishedTime: "Descending" };
			options.ModalOptions.ComponentProps.preProcess = (contents: Array<any>) => contents.forEach(data => {
				const content = Content.update(data);
				if (content.category === undefined) {
					this.portalsCmsSvc.getCategoryAsync(content.CategoryID, _ => {
						const category = Category.get(content.CategoryID);
						if (category !== undefined) {
							this.portalsCmsSvc.fetchDesktops(category);
						}
					});
				}
			});
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExternalRelateds"));
		control.SubControls.Controls[0].SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Summary")).Options.Rows = 2;
		control.SubControls.Controls[0].SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "URL")).Options.Icon = {
			Name: "globe",
			Fill: "clear",
			Color: "medium",
			Slot: "end",
			OnClick: (_, formControl) => PlatformUtility.openURI(formControl.value)
		};

		if (AppUtility.isArray(this.content.ExternalRelateds, true) && this.content.ExternalRelateds.length > 1) {
			while (control.SubControls.Controls.length <= this.content.ExternalRelateds.length) {
				control.SubControls.Controls.push(this.appFormsSvc.cloneControl(control.SubControls.Controls[0], ctrl => {
					ctrl.Name = `${control.Name}_${control.SubControls.Controls.length}`;
					ctrl.Order = control.SubControls.Controls.length;
				}));
			}
		}
		control.SubControls.Controls.forEach((ctrl, index) => ctrl.Options.Label = `#${index + 1}`);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (AppUtility.isNotEmpty(this.content.ID)) {
			formConfig.push(
				this.portalsCoreSvc.getAuditFormControl(this.content, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.cms.contents.update.buttons.delete}}",
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
		else {
			control.Options.OnBlur = (_, formControl) => this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true), { onlySelf: true });
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}

		return formConfig;
	}

	onFormInitialized() {
		const content = AppUtility.clone(this.content, false, ["StartDate", "EndDate", "PublishedTime"]);
		content.StartDate = AppUtility.toIsoDate(this.content.StartDate);
		content.EndDate = AppUtility.toIsoDate(this.content.EndDate);
		content.PublishedTime = AppUtility.toIsoDate(this.content.PublishedTime);

		this.form.patchValue(content);
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

				const content = this.form.value;
				content.StartDate = AppUtility.toIsoDate(content.StartDate !== undefined ? content.StartDate : new Date()).replace(/\-/g, "/");
				content.EndDate = content.EndDate !== undefined ? AppUtility.toIsoDate(content.EndDate).replace(/\-/g, "/") : undefined;
				content.PublishedTime = content.PublishedTime !== undefined ? AppUtility.toIsoDate(content.PublishedTime).replace(/\-/g, "/") : undefined;

				if (AppUtility.isNotEmpty(content.ID)) {
					const oldCategoryID = this.content.CategoryID;
					await this.portalsCmsSvc.updateContentAsync(
						content,
						async data => {
							AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Updated", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: data.CategoryID });
							if (oldCategoryID !== data.CategoryID) {
								AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Updated", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: oldCategoryID });
							}
							if (AppUtility.isArray(data.OtherCategories)) {
								(data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Updated", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: categoryID }));
							}
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
				else {
					await this.portalsCmsSvc.createContentAsync(
						content,
						async data => {
							AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Created", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: data.CategoryID });
							if (AppUtility.isArray(data.OtherCategories)) {
								(data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Created", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: categoryID }));
							}
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete"));
				await this.portalsCmsSvc.deleteContentAsync(
					this.content.ID,
					async data => {
						AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: data.CategoryID });
						if (AppUtility.isArray(data.OtherCategories)) {
							(data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: categoryID }));
						}
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error))
				);
			},
			await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.remove"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string, url?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.cms.contents.update.messages.confirm.${AppUtility.isNotEmpty(this.content.ID) ? "cancel" : "new"}`),
			undefined,
			async () => await this.configSvc.navigateBackAsync(url),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
