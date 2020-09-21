import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization } from "@app/models/portals.core.organization";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";
import { Expression } from "@app/models/portals.core.expression";

@Component({
	selector: "page-portals-core-expressions-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsExpressionsUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private expression: Expression;
	private organization: Organization;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private hash = "";
	private unspecified = "unspecified";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
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

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.expression = Expression.get(this.configSvc.requestParams["ID"]);

		this.organization = this.expression !== undefined
			? Organization.get(this.expression.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.expression.SystemID, _ => this.organization = Organization.get(this.expression.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		if (this.organization.modules.length < 1) {
			const request = AppPagination.buildRequest(
				{ And: [{ SystemID: { Equals: this.organization.ID } }] },
				{ Title: "Ascending" },
				{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
			);
			await this.portalsCoreSvc.searchModuleAsync(request, undefined, undefined, true, true);
		}

		if (this.organization.modules.length < 1) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.expressions.list.invalid")));
			return;
		}

		if (this.expression === undefined) {
			const moduleID = this.configSvc.requestParams["RepositoryID"];
			const module = AppUtility.isNotEmpty(moduleID)
				? this.organization.modules.find(m => m.ID === moduleID)
				: this.organization.modules[0];
			const contentTypeDefinitionID = this.configSvc.requestParams["ContentTypeDefinitionID"] || this.getContentTypeDefinitions(module.ID)[0].ID;
			const contentTypes = module.contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === contentTypeDefinitionID);
			const contentTypeID = this.configSvc.requestParams["RepositoryEntityID"] || contentTypes.length > 0 ? contentTypes[0].ID : undefined;
			this.expression = new Expression(this.organization.ID, module.ID, contentTypeDefinitionID, contentTypeID, this.configSvc.requestParams["Title"]);
		}

		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.expression.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.expressions.title.${(AppUtility.isNotEmpty(this.expression.ID) ? "update" : "create")}`);
		this.unspecified = await this.configSvc.getResourceAsync("portals.common.unspecified");

		this.buttons = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.expression.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.expressions.update.segments.basic"))
		];
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			formSegments.push(
				new AppFormsSegment("filter", await this.configSvc.getResourceAsync("portals.expressions.update.segments.filter")),
				new AppFormsSegment("sorts", await this.configSvc.getResourceAsync("portals.expressions.update.segments.sorts"))
			);
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "expression");

		formConfig.insert({
			Name: "Organization",
			Type: "Text",
			Segment: "basic",
			Extras: { Text: this.organization.Title },
			Options: {
				Label: "{{portals.expressions.controls.Organization}}",
				ReadOnly: true
			}
		}, 0);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryID"));
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			formConfig.insert({
				Name: "Repository",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: Module.get(this.expression.RepositoryID).Title },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}
		else {
			control.Options.SelectOptions.Values = this.organization.modules.map(module => {
				return { Value: module.ID, Label: module.Title };
			});
			control.Options.OnChanged = async (_, formControl) => {
				const definitions = this.getContentTypeDefinitions(formControl.value);
				const definitionsControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"));
				definitionsControl.Options.SelectOptions.Values = definitions.map(definition => {
					return { Value: definition.ID, Label: definition.Title };
				});
				definitionsControl.controlRef.setValue(definitions[0].ID, { onlySelf: true });
			};
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"));
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			if (AppUtility.isNotEmpty(this.expression.ContentTypeDefinitionID)) {
				formConfig.insert({
					Name: "ContentTypeDefinition",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: this.getContentTypeDefinitions(this.expression.RepositoryID).find(definition => definition.ID  === this.expression.ContentTypeDefinitionID).Title },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
			}
		}
		else {
			control.Options.SelectOptions.Values = this.getContentTypeDefinitions(this.organization.modules[0].ID).map(definition => {
				return { Value: definition.ID, Label: definition.Title };
			});
			control.Options.OnChanged = (_, formControl) => {
				const module = Module.get(this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryID")).value);
				const contentTypeDefinitionID = formControl.value;
				const contentTypes = module.contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === contentTypeDefinitionID);
				const contentTypeControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryEntityID"));
				contentTypeControl.Options.SelectOptions.Values = contentTypes.map(contentType => {
					return { Value: contentType.ID, Label: contentType.Title };
				});
				contentTypeControl.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);
				contentTypeControl.controlRef.setValue(contentTypes.length > 0 ? contentTypes[0].ID : "-", { onlySelf: true });
			};
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryEntityID"));
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			if (AppUtility.isNotEmpty(this.expression.RepositoryEntityID)) {
				formConfig.insert({
					Name: "RepositoryEntity",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: ContentType.get(this.expression.RepositoryEntityID).Title },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
			}
		}
		else {
			const module = AppUtility.isNotEmpty(this.expression.RepositoryID)
				? this.organization.modules.find(m => m.ID === this.expression.RepositoryID)
				: this.organization.modules[0];
			const contentTypeDefinitionID = AppUtility.isNotEmpty(this.expression.ContentTypeDefinitionID)
				? this.expression.ContentTypeDefinitionID
				: this.getContentTypeDefinitions(module.ID)[0].ID;
			const contentTypes = module.contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === contentTypeDefinitionID);
			control.Options.SelectOptions.Values = contentTypes.map(contentType => {
				return { Value: contentType.ID, Label: contentType.Title };
			});
			control.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);
		}

		if (AppUtility.isNotEmpty(this.expression.ID)) {
			formConfig.push(
				{
					Name: "Filter",
					Type: "TextArea",
					Segment: "filter",
					Options: {
						Label: control.Options.Label.replace("RepositoryEntityID", "Filter"),
						Rows: 25
					}
				},
				{
					Name: "Sorts",
					Type: "TextArea",
					Segment: "sorts",
					Options: {
						Label: control.Options.Label.replace("RepositoryEntityID", "Sorts"),
						Rows: 25
					}
				},
				this.portalsCoreSvc.getAuditFormControl(this.expression, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.expressions.update.buttons.delete}}",
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
		if (AppUtility.isNotEmpty(this.expression.ID)) {
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

	private getContentTypeDefinitions(moduleID: string) {
		const moduleDefinitionID = Module.get(moduleID).ModuleDefinitionID;
		return Module.moduleDefinitions.find(definition => definition.ID === moduleDefinitionID).ContentTypeDefinitions.filter(definition => definition.Portlets);
	}

	onFormInitialized() {
		this.form.patchValue(this.expression);
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			this.form.controls.Filter.setValue(JSON.stringify(this.expression.Filter), { onlySelf: true });
			this.form.controls.Sorts.setValue(JSON.stringify(this.expression.Sorts), { onlySelf: true });
		}
		else {
			this.form.controls.ContentTypeDefinitionID.setValue(this.expression.ContentTypeDefinitionID || this.getContentTypeDefinitions(this.expression.RepositoryID)[0].ID, { onlySelf: true });
		}
		this.appFormsSvc.hideLoadingAsync(() => {
			this.hash = AppCrypto.hash(this.form.value);
			if (this.configSvc.isDebug) {
				console.log("<Portals>: Expression", this.expression, this.form.value);
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

				const expression = this.form.value;
				expression.RepositoryEntityID = AppUtility.isNotEmpty(expression.RepositoryEntityID) && expression.RepositoryEntityID !== "-" ? expression.RepositoryEntityID : undefined;

				if (AppUtility.isNotEmpty(this.expression.ID)) {
					try {
						expression.Filter = AppUtility.isNotEmpty(expression.Filter)
							? JSON.parse(expression.Filter)
							: undefined;
						expression.Sorts = AppUtility.isNotEmpty(expression.Sorts)
							? JSON.parse(expression.Sorts)
							: undefined;
					}
					catch (error) {
						this.processing = false;
						console.error("Error occurred while parsing JSON of expressions", error);
						await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.expressions.update.messages.json")});
						return;
					}
				}
				else {
					expression.Filter = this.configSvc.requestParams["Filter"];
					expression.Sorts = this.configSvc.requestParams["Sorts"];
				}

				if (AppUtility.isNotEmpty(expression.ID)) {
					await this.portalsCoreSvc.updateExpressionAsync(
						expression,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Updated", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.update")),
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
					await this.portalsCoreSvc.createExpressionAsync(
						expression,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Created", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.new")),
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
			await this.configSvc.getResourceAsync("portals.expressions.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.expressions.update.buttons.delete"));
				await this.portalsCoreSvc.deleteExpressionAsync(
					this.expression.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Deleted", ID: data.ID });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.expressions.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.delete")),
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
		if (message === undefined && this.hash === AppCrypto.hash(this.form.value)) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				message || await this.configSvc.getResourceAsync(`portals.expressions.update.messages.confirm.${AppUtility.isNotEmpty(this.expression.ID) ? "cancel" : "new"}`),
				undefined,
				async () => await this.configSvc.navigateBackAsync(),
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}
	}

}
