import { Injectable } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, FormArray } from "@angular/forms";
import { Validators, ValidatorFn, AsyncValidatorFn } from "@angular/forms";
import { LoadingController, AlertController, ActionSheetController, ModalController, ToastController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { AppConfig } from "@app/app.config";
import { AppAPIs } from "@app/components/app.apis";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsControlConfig, AppFormsSegment, AppFormsControl, AppFormsLookupValue } from "@app/components/forms.objects";
import { ConfigurationService } from "@app/services/configuration.service";

/** Provides the servicing operations of the dynamic forms */
@Injectable()
export class AppFormsService {

	constructor(
		private translateSvc: TranslateService,
		private configSvc: ConfigurationService,
		private loadingController: LoadingController,
		private alertController: AlertController,
		private actionsheetController: ActionSheetController,
		private modalController: ModalController,
		private toastController: ToastController
	) {
	}

	private _loading: any;
	private _actionsheet: any;
	private _modal: {
		component: any;
		onDismiss: (data?: any) => void
	};
	private _alert: any;
	private _toast: any;
	private _types = {
		text: ["text", "password", "email", "search", "tel", "url"],
		datetime: ["date", "datetime", "datetime-local"]
	};
	private _metaCounties: {
		[key: string]: Array<{ County: string, Province: string, Country: string, Title: string, TitleANSI: string}>
	} = {};

	private get canModifyDatePickers() {
		return !AppConfig.isNativeApp && AppConfig.app.platform.indexOf("Desktop") > -1 && !AppUtility.isAppleSafari();
	}

	public async normalizeResourceAsync(resource: string, interpolateParams?: object) {
		return AppUtility.isNotEmpty(resource) && resource.startsWith("{{") && resource.endsWith("}}")
			? await this.getResourceAsync(resource.substr(2, resource.length - 4).trim(), interpolateParams)
			: resource;
	}

	public prepareSelectControl(formControl: AppFormsControlConfig, selectValues?: string | string[] | AppFormsLookupValue[], onCompleted?: (formControl: AppFormsControlConfig) => void) {
		const values = selectValues || formControl.Options.SelectOptions.Values;
		formControl.Options.SelectOptions.Values = AppUtility.isArray(values, true) && AppUtility.isGotData(values)
			? typeof (values as Array<any>).first() === "string"
				? (values as Array<string>).map(value => ({ Value: value, Label: value }) as AppFormsLookupValue)
				: (values as Array<any>).map(data => formControl.Options.SelectOptions.RemoteURIConverter !== undefined ? formControl.Options.SelectOptions.RemoteURIConverter(data) : ({ Value: data.Value || data.value, Label: data.Label || data.label || data.Value || data.value, Description: data.Description || data.description }) as AppFormsLookupValue)
			: AppUtility.isNotEmpty(values)
				? ((values as string).indexOf("#;") > 0 ? (values as string).split("#;") : (values as string).split(";")).map(value => value.split("|")).map(data => ({ Value: data.first(), Label: data.last() }) as AppFormsLookupValue)
				: AppUtility.isNotNull(values)
					? [{ Value: values.toString(), Label: values.toString() } as AppFormsLookupValue]
					: [];
		if (onCompleted !== undefined) {
			onCompleted(formControl);
		}
	}

	private async prepareControlsAsync(formControls: Array<AppFormsControl>, modifyDatePickers?: boolean) {
		formControls.forEach((formControl, index) => {
			if (index < formControls.length - 1) {
				formControl.next = formControls[index + 1];
			}
		});
		await Promise.all(formControls.map(async formControl => {
			formControl.Options.Label = await this.normalizeResourceAsync(formControl.Options.Label);
			formControl.Options.Description = await this.normalizeResourceAsync(formControl.Options.Description);
			formControl.Options.PlaceHolder = await this.normalizeResourceAsync(formControl.Options.PlaceHolder);
			if (formControl.Type === "Select") {
				if (AppUtility.isNotEmpty(formControl.Options.SelectOptions.RemoteURI)) {
					const url = AppAPIs.getURL(formControl.Options.SelectOptions.RemoteURI) + (formControl.Options.SelectOptions.RemoteURI.indexOf("?") < 0 ? "?" : "&") + AppConfig.getRelatedQuery();
					try {
						this.prepareSelectControl(
							formControl,
							formControl.Options.SelectOptions.RemoteURIProcessor !== undefined
								? await formControl.Options.SelectOptions.RemoteURIProcessor(url, formControl.Options.SelectOptions.RemoteURIConverter)
								: url.indexOf("discovery/definitions?") > 0 ? await this.configSvc.fetchDefinitionAsync(url) : await AppAPIs.sendXMLHttpRequestAsync("GET", url)
						);
					}
					catch (error) {
						console.error("[Forms]: Error occurred while preparing the selecting values from a remote URI", error);
						formControl.Options.SelectOptions.Values = [];
					}
				}
				else {
					this.prepareSelectControl(formControl);
				}
				if (AppUtility.isArray(formControl.Options.SelectOptions.Values, true)) {
					await Promise.all(formControl.Options.SelectOptions.Values.map(async selectValue => {
						selectValue.Value = await this.normalizeResourceAsync(selectValue.Value);
						selectValue.Label = await this.normalizeResourceAsync(selectValue.Label);
					}));
				}
				formControl.Options.SelectOptions.OkText = await this.normalizeResourceAsync(formControl.Options.SelectOptions.OkText);
				formControl.Options.SelectOptions.CancelText = await this.normalizeResourceAsync(formControl.Options.SelectOptions.CancelText);
			}
			else if (AppUtility.isEquals(formControl.Type, "Lookup")) {
				if (AppUtility.isNotEmpty(formControl.Options.LookupOptions.WarningOnDelete)) {
					formControl.Options.LookupOptions.WarningOnDelete = await this.normalizeResourceAsync(formControl.Options.LookupOptions.WarningOnDelete);
				}
				formControl.Options.LookupOptions.CompleterOptions.SearchingText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.CompleterOptions.SearchingText);
				formControl.Options.LookupOptions.CompleterOptions.NoResultsText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.CompleterOptions.NoResultsText);
				if (AppUtility.isNotEmpty(formControl.Options.LookupOptions.SelectorOptions.HeaderText)) {
					formControl.Options.LookupOptions.SelectorOptions.HeaderText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.SelectorOptions.HeaderText);
				}
				formControl.Options.LookupOptions.SelectorOptions.OkText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.SelectorOptions.OkText);
				formControl.Options.LookupOptions.SelectorOptions.CancelText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.SelectorOptions.CancelText);
			}
			else if (AppUtility.isEquals(formControl.Type, "DatePicker")) {
				if (AppUtility.isTrue(modifyDatePickers)) {
					formControl.Type = "TextBox";
					formControl.Options.Type = formControl.Options.DatePickerOptions.AllowTimes ? "datetime-local" : "date";
				}
				else  {
					formControl.Options.DatePickerOptions.DayNames = await this.normalizeResourceAsync(formControl.Options.DatePickerOptions.DayNames);
					formControl.Options.DatePickerOptions.DayShortNames = await this.normalizeResourceAsync(formControl.Options.DatePickerOptions.DayShortNames);
					formControl.Options.DatePickerOptions.MonthNames = await this.normalizeResourceAsync(formControl.Options.DatePickerOptions.MonthNames);
					formControl.Options.DatePickerOptions.MonthShortNames = await this.normalizeResourceAsync(formControl.Options.DatePickerOptions.MonthShortNames);
					formControl.Options.DatePickerOptions.DoneText = await this.normalizeResourceAsync(formControl.Options.DatePickerOptions.DoneText);
					formControl.Options.DatePickerOptions.CancelText = await this.normalizeResourceAsync(formControl.Options.DatePickerOptions.CancelText);
				}
			}
			else if (AppUtility.isEquals(formControl.Type, "FilePicker") && AppUtility.isNotEmpty(formControl.Options.FilePickerOptions.WarningOnDelete)) {
				formControl.Options.FilePickerOptions.WarningOnDelete = await this.normalizeResourceAsync(formControl.Options.FilePickerOptions.WarningOnDelete);
			}
			else if (AppUtility.isEquals(formControl.Type, "Lookup") && AppUtility.isEquals(formControl.Options.Type, "selector")) {
				if (AppUtility.isNotEmpty(formControl.Options.LookupOptions.WarningOnDelete)) {
					formControl.Options.LookupOptions.WarningOnDelete = await this.normalizeResourceAsync(formControl.Options.LookupOptions.WarningOnDelete);
				}
				if (AppUtility.isNotEmpty(formControl.Options.LookupOptions.SelectorOptions.HeaderText)) {
					formControl.Options.LookupOptions.SelectorOptions.HeaderText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.SelectorOptions.HeaderText);
				}
				formControl.Options.LookupOptions.SelectorOptions.OkText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.SelectorOptions.OkText);
				formControl.Options.LookupOptions.SelectorOptions.CancelText = await this.normalizeResourceAsync(formControl.Options.LookupOptions.SelectorOptions.CancelText);
			}
			if (formControl.SubControls !== undefined) {
				await this.prepareControlsAsync(formControl.SubControls.Controls, modifyDatePickers);
				formControl.SubControls.Controls.forEach(subcontrol => subcontrol.parent = formControl);
			}
		}));
	}

	/** Gets the definition of all controls */
	public getControls(formConfig: Array<AppFormsControlConfig> = [], formControls?: Array<AppFormsControl>, formSegments?: { items: Array<AppFormsSegment>, default: string, current: string }) {
		formControls = formControls || new Array<AppFormsControl>();
		formConfig.map((options, order) => {
			const formControl = new AppFormsControl(options, order);
			if (formSegments !== undefined && formSegments.items !== undefined && formSegments.items.length > 0) {
				if (formControl.Segment === undefined) {
					formControl.Segment = formSegments.default !== undefined && formSegments.items.findIndex(segment => AppUtility.isEquals(segment.Name, formSegments.default)) > -1
						? formSegments.default
						: formSegments.items[0].Name;
				}
				const segmentIndex = formSegments.items.findIndex(segment => AppUtility.isEquals(segment.Name, formControl.Segment));
				formControl.Segment = segmentIndex < 0 ? formSegments.items[0].Name : formControl.Segment;
				formControl.segmentIndex = segmentIndex < 0 ? 0 : segmentIndex;
			}
			return formControl;
		})
		.sortBy("segmentIndex", "Order")
		.forEach((formControl, order) => {
			formControl.Order = order;
			formControls.push(formControl);
		});
		this.prepareControlsAsync(formControls, this.canModifyDatePickers);
		return formControls;
	}

	/** Updates the definition of all controls */
	public updateControls(formControls: Array<AppFormsControl> = [], value: any = {}) {
		formControls.forEach((formControl, order) => formControl.Order = order);
		formControls.filter(formControl => formControl.SubControls !== undefined).forEach(formControl => {
			if (formControl.SubControls.AsArray) {
				const values = value[formControl.Name] as Array<any>;
				while (formControl.SubControls.Controls.length < values.length) {
					formControl.SubControls.Controls.push(new AppFormsControl(formControl.SubControls.Controls[0], formControl.SubControls.Controls.length));
				}
				formControl.SubControls.Controls.forEach((subcontrol, subindex) => {
					if (subcontrol.SubControls !== undefined) {
						this.updateControls(subcontrol.SubControls.Controls, values[subindex]);
					}
				});
			}
			else {
				this.updateControls(formControl.SubControls.Controls, value[formControl.Name]);
			}
		});
	}

	/** Copies the form control (creates new instance) */
	public copyControl(formControl: AppFormsControl, onCompleted?: (control: AppFormsControl) => void) {
		const control = new AppFormsControl(formControl);
		control.parent = formControl.parent;
		control.segmentIndex = formControl.segmentIndex;
		if (onCompleted !== undefined) {
			onCompleted(control);
		}
		return control;
	}

	/** Copies the form control config (clones a new instance) */
	public cloneControl(config: AppFormsControlConfig, onCompleted?: (config: AppFormsControlConfig) => void) {
		return AppUtility.clone(config, false, undefined, onCompleted);
	}

	/** Builds an Angular form */
	public buildForm(form: FormGroup, formControls: Array<AppFormsControl> = [], value?: any, validators?: Array<ValidatorFn>, asyncValidators?: Array<AsyncValidatorFn>) {
		this.getFormGroup(formControls, form, validators, asyncValidators);
		if (value !== undefined) {
			this.updateControls(formControls, value);
			this.prepareControlsAsync(formControls, this.canModifyDatePickers);
			form.patchValue(value);
		}
		else {
			this.prepareControlsAsync(formControls, this.canModifyDatePickers);
		}
	}

	/** Gets an Angular form group */
	public getFormGroup(formControls: Array<AppFormsControl>, formGroup?: FormGroup, validators?: Array<ValidatorFn>, asyncValidators?: Array<AsyncValidatorFn>) {
		formGroup = formGroup || new FormGroup({}, validators, asyncValidators);
		formControls.forEach(formControl => {
			if (formControl.SubControls === undefined && AppUtility.isEquals(formControl.Type, "Lookup") && formControl.Options.LookupOptions.AsCompleter && AppUtility.isEquals(formControl.Options.Type, "Address")) {
				["County", "Province", "Country"].forEach(name => formGroup.addControl(name, this.getFormControl(formControl)));
			}
			else {
				const frmControl = formControl.SubControls === undefined
					? AppUtility.isEquals(formControl.Type, "Text")
						? undefined
						: this.getFormControl(formControl)
					: formControl.SubControls.AsArray
						? this.getFormArray(formControl, this.getValidators(formControl), this.getAsyncValidators(formControl))
						: AppUtility.isEquals(formControl.Type, "Buttons")
							? undefined
							: this.getFormGroup(formControl.SubControls.Controls, undefined, this.getValidators(formControl), this.getAsyncValidators(formControl));
				if (frmControl !== undefined) {
					formGroup.addControl(formControl.Name, frmControl);
				}
			}
		});
		return formGroup;
	}

	/** Gets an Angular form array */
	public getFormArray(formControl: AppFormsControl, validators?: Array<ValidatorFn>, asyncValidators?: Array<AsyncValidatorFn>) {
		const formArray = new FormArray([], validators, asyncValidators);
		formControl.SubControls.Controls.forEach(subFormControl => {
			if (subFormControl.SubControls === undefined && AppUtility.isEquals(subFormControl.Type, "Lookup") && formControl.Options.LookupOptions.AsCompleter && AppUtility.isEquals(subFormControl.Options.Type, "Address")) {
				const formGroup = new FormGroup({}, this.getValidators(subFormControl), this.getAsyncValidators(subFormControl));
				["County", "Province", "Country"].forEach(name => formGroup.addControl(name, this.getFormControl(subFormControl)));
				formArray.push(formGroup);
			}
			else {
				const frmControl: AbstractControl = subFormControl.SubControls === undefined
					? this.getFormControl(subFormControl)
					: subFormControl.SubControls.AsArray
						? this.getFormArray(subFormControl, this.getValidators(subFormControl), this.getAsyncValidators(subFormControl))
						: this.getFormGroup(subFormControl.SubControls.Controls, undefined, this.getValidators(subFormControl), this.getAsyncValidators(subFormControl));
				formArray.push(frmControl);
			}
		});
		return formArray;
	}

	/** Gets an Angular form control */
	public getFormControl(formControl: AppFormsControl) {
		return new FormControl(undefined, this.getValidators(formControl), this.getAsyncValidators(formControl));
	}

	/** Gets the validators of an Angular form control */
	public getValidators(formControl: AppFormsControl) {
		let validators = new Array<ValidatorFn>();

		if (formControl.Validators !== undefined && formControl.Validators.length > 0) {
			if (typeof formControl.Validators[0] === "string") {

			}
			else {
				validators = formControl.Validators as Array<ValidatorFn>;
			}
		}

		if (formControl.Required) {
			validators.push(Validators.required);
		}

		if (this._types.text.findIndex(type => AppUtility.isEquals(type, formControl.Options.Type)) > -1) {
			if (formControl.Options.MinLength > 0) {
				validators.push(Validators.minLength(formControl.Options.MinLength));
			}
			if (formControl.Options.MaxLength > 0) {
				validators.push(Validators.maxLength(formControl.Options.MaxLength));
			}
			if (AppUtility.isEquals(formControl.Options.Type, "email")) {
				validators.push(Validators.pattern("([a-zA-Z0-9_.-]+)@([a-zA-Z0-9_.-]+)\\.([a-zA-Z]{2,5})"));
			}
		}
		else if (this._types.datetime.findIndex(type => AppUtility.isEquals(type, formControl.Options.Type)) > -1) {
			if (formControl.Options.MinValue !== undefined) {
				validators.push(this.minDate(formControl.Options.MinValue));
			}
			if (formControl.Options.MaxValue !== undefined) {
				validators.push(this.maxDate(formControl.Options.MaxValue));
			}
		}
		else if (AppUtility.isEquals("number", formControl.Options.Type)) {
			if (formControl.Options.MinValue !== undefined) {
				validators.push(Validators.min(+formControl.Options.MinValue));
			}
			if (formControl.Options.MaxValue !== undefined) {
				validators.push(Validators.max(+formControl.Options.MaxValue));
			}
		}

		if (AppUtility.isNotEmpty(formControl.Options.ValidatePattern)) {
			validators.push(Validators.pattern(formControl.Options.ValidatePattern));
		}

		return validators;
	}

	/** Gets the async validators of an Angular form control */
	public getAsyncValidators(formControl: AppFormsControl) {
		const asyncValidators = new Array<AsyncValidatorFn>();
		return asyncValidators;
	}

	/** Gets the forms' button controls */
	public getButtonControls(segment: string, ...buttons: Array<{ Name: string; Label: string; OnClick: (event: Event, control: AppFormsControl) => void; Options?: { Fill?: string; Color?: string; Css?: string; Icon?: { Name?: string; Slot?: string } } }>) {
		return {
			Name: "Buttons",
			Type: "Buttons",
			Segment: segment,
			SubControls: {
				Controls: buttons.map(button => ({
					Name: button.Name,
					Type: "Button",
					Options: {
						Label: button.Label,
						Css: (button.Options !== undefined ? button.Options.Css : undefined) || "",
						ButtonOptions: {
							OnClick: button.OnClick,
							Fill: (button.Options !== undefined ? button.Options.Fill : undefined) || "solid",
							Color: (button.Options !== undefined ? button.Options.Color : undefined) || "primary",
							Icon: {
								Name: button.Options !== undefined && button.Options.Icon !== undefined ? button.Options.Icon.Name : undefined,
								Slot: (button.Options !== undefined && button.Options.Icon !== undefined ? button.Options.Icon.Slot : undefined) || "start"
							}
						}
					}
				}))
			}
		} as AppFormsControlConfig;
	}

	/** Validates the form and highlights all invalid controls (if has) */
	public validate(form: FormGroup, onCompleted?: (form: FormGroup, valid: boolean) => void) {
		form.updateValueAndValidity();
		const invalid = form.invalid;
		if (invalid) {
			this.highlightInvalids(form);
		}
		if (onCompleted !== undefined) {
			onCompleted(form, !invalid);
		}
		return !invalid;
	}

	/** Highlights all invalid controls (by mark as dirty on all invalid controls) and set focus into first invalid control */
	public highlightInvalids(form: FormGroup) {
		const formControl = this.highlightInvalidsFormGroup(form, form["_controls"] as Array<AppFormsControl>);
		if (formControl !== undefined) {
			if (AppUtility.isNotEmpty(formControl.Segment) && form["_segments"] !== undefined) {
				try {
					form["_segments"].current = formControl.Segment;
				}
				catch (error) {
					console.error("[Forms]: Cannot update form's segment", error);
				}
			}
			console.warn(`[Forms]: Invalid => ${formControl.Name}`, formControl.formControlRef.value);
			formControl.focus();
		}
		return formControl;
	}

	private highlightInvalidsFormGroup(formGroup: FormGroup, formControls: Array<AppFormsControl>) {
		let firstControl: AppFormsControl;
		Object.keys(formGroup.controls).forEach(key => {
			const formControl = formGroup.controls[key];
			if (formControl.invalid) {
				const control = formControls.find(ctrl => ctrl.Name === key);
				const subcontrols = control !== undefined && control.SubControls !== undefined ? control.SubControls.Controls : undefined;
				if (formControl instanceof FormGroup) {
					firstControl = firstControl || this.highlightInvalidsFormGroup(formControl as FormGroup, subcontrols);
				}
				else if (formControl instanceof FormArray) {
					firstControl = firstControl || this.highlightInvalidsFormArray(formControl as FormArray, subcontrols);
				}
				else {
					formControl.markAsDirty();
					firstControl = firstControl || control;
				}
			}
		});
		return firstControl;
	}

	private highlightInvalidsFormArray(formArray: FormArray, formControls: Array<AppFormsControl>) {
		let firstControl: AppFormsControl;
		formArray.controls.forEach((control, index) => {
			if (control.invalid) {
				if (control instanceof FormGroup) {
					firstControl = firstControl || this.highlightInvalidsFormGroup(control as FormGroup, formControls[index] !== undefined && formControls[index].SubControls !== undefined ? formControls[index].SubControls.Controls : undefined);
				}
				else if (control instanceof FormArray) {
					firstControl = firstControl || this.highlightInvalidsFormArray(control as FormArray, formControls[index] !== undefined && formControls[index].SubControls !== undefined ? formControls[index].SubControls.Controls : undefined);
				}
				else {
					control.markAsDirty();
					firstControl = firstControl || formControls[index];
				}
			}
		});
		return firstControl;
	}

	/** Sets focus into control */
	public focus(formControl: AppFormsControl, whenNoControlFound?: () => void) {
		if (formControl !== undefined) {
			formControl.focus();
		}
		else if (whenNoControlFound !== undefined) {
			whenNoControlFound();
		}
	}

	private getNext(formControl: AppFormsControl) {
		let next = formControl !== undefined ? formControl.next : undefined;
		while (next !== undefined && next.Hidden) {
			next = next.next;
		}
		return next;
	}

	/** Sets focus into next control */
	public focusNext(formControl: AppFormsControl, whenNoControlFound?: () => void) {
		this.focus(this.getNext(formControl), whenNoControlFound);
	}

	/** Checks values of two controls are equal or not */
	public areEquals(original: string, confirm: string): ValidatorFn {
		return (formGroup: FormGroup): { [key: string]: any } | null => {
			const originalControl = formGroup.controls[original];
			const confirmControl = formGroup.controls[confirm];
			if (originalControl !== undefined && confirmControl !== undefined && !AppUtility.isEquals(originalControl.value, confirmControl.value)) {
				confirmControl.setErrors({ notEquivalent: true });
				return { notEquivalent: true };
			}
			return null;
		};
	}

	/** Checks value of the control is equal with other control value or not */
	public isEquals(other: string): ValidatorFn {
		return (formControl: AbstractControl): { [key: string]: any } | null => {
			const otherControl = formControl.parent instanceof FormGroup
				? (formControl.parent as FormGroup).controls[other]
				: undefined;
			if (otherControl !== undefined && !AppUtility.isEquals(otherControl.value, formControl.value)) {
				formControl.setErrors({ notEquivalent: true });
				return { notEquivalent: true };
			}
			return null;
		};
	}

	/** Checks value of the date control is greater or equal a specific value */
	public minDate(date: string): ValidatorFn {
		return (formControl: AbstractControl): { [key: string]: any } | null => {
			if (date !== undefined && formControl.value !== undefined && new Date(formControl.value) < new Date(date)) {
				formControl.setErrors({ lessThan: true });
				return { lessThan: true };
			}
			return null;
		};
	}

	/** Checks value of the date control is less than or equal a specific value */
	public maxDate(date: string): ValidatorFn {
		return (formControl: AbstractControl): { [key: string]: any } | null => {
			if (date !== undefined && formControl.value !== undefined && new Date(formControl.value) > new Date(date)) {
				formControl.setErrors({ greater: true });
				return { greater: true };
			}
			return null;
		};
	}

	/** Gets the listing of meta counties of a specified country */
	public getMetaCounties(country?: string) {
		country = country || AppConfig.geoMeta.country;
		if (this._metaCounties[country] === undefined && AppConfig.geoMeta.provinces[country] !== undefined) {
			const counties = new Array<{
				County: string,
				Province: string,
				Country: string,
				Title: string,
				TitleANSI: string
			}>();
			const provinces = AppConfig.geoMeta.provinces[country].provinces || [];
			provinces.forEach(province => province.counties.forEach(county => counties.push({
				County: county.title,
				Province: province.title,
				Country: country,
				Title: `${county.title}, ${province.title}, ${country}`,
				TitleANSI: AppUtility.toANSI(`${county.title}, ${province.title}, ${country}`)
			})));
			this._metaCounties[country] = counties;
		}
		return this._metaCounties[country] || [];
	}

	/** Gets the resource of current language by a key */
	public getResourceAsync(key: string, interpolateParams?: object) {
		return AppUtility.toAsync<string>(this.translateSvc.get(key, interpolateParams));
	}

	/** Shows the loading */
	public async showLoadingAsync(message?: string) {
		await this.hideLoadingAsync();
		this._loading = await this.loadingController.create({
			message: message || await this.getResourceAsync("common.messages.loading")
		});
		await this._loading.present();
	}

	/** Hides the loading */
	public async hideLoadingAsync(onNext?: () => void) {
		if (this._loading !== undefined) {
			await this._loading.dismiss();
			this._loading = undefined;
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	/** Get the button for working with action sheet */
	public getActionSheetButton(text: string, icon?: string, handler?: () => void, role?: string) {
		return {
			text: text,
			role: role,
			icon: icon,
			handler: handler
		};
	}

	/** Shows the action sheet */
	public async showActionSheetAsync(buttons: Array<{ text: string; role?: string; icon?: string; handler?: () => void }>, backdropDismiss: boolean = true, dontAddCancelButton: boolean = false) {
		await this.hideLoadingAsync();
		if (AppUtility.isFalse(dontAddCancelButton)) {
			buttons.push(this.getActionSheetButton(await this.getResourceAsync("common.buttons.cancel"), "close", () => this.hideActionSheetAsync(), "cancel"));
		}
		if (AppConfig.isRunningOnIOS) {
			buttons.forEach(button => button.icon = undefined);
		}
		this._actionsheet = await this.actionsheetController.create({
			buttons: buttons,
			backdropDismiss: backdropDismiss
		});
		await this._actionsheet.present().then(AppUtility.isFalse(dontAddCancelButton) ? () => buttons.removeAt(buttons.length - 1) : () => {});
	}

	/** Hides the action sheet */
	public async hideActionSheetAsync(onNext?: () => void) {
		if (this._actionsheet !== undefined) {
			await this._actionsheet.dismiss();
			this._actionsheet = undefined;
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	/** Shows the alert box  */
	public async showAlertAsync(header: string = null, message: string = null, subMessage?: string, onOkClick?: (data?: any) => void, okButtonText?: string, cancelButtonText?: string, inputs?: Array<any>, backdropDismiss: boolean = false) {
		await this.hideLoadingAsync();
		await this.hideAlertAsync();
		const buttons: Array<{ text: string; role: string; handler: (data?: any) => void; }> = AppUtility.isNotEmpty(cancelButtonText)
			? [{ text: cancelButtonText, role: "cancel", handler: () => this.hideAlertAsync() }]
			: [];
		buttons.push({
			text: okButtonText || await this.getResourceAsync("common.buttons.ok"),
			role: undefined as string,
			handler: (data?: any) => {
				if (onOkClick !== undefined) {
					onOkClick(data);
				}
				this.hideAlertAsync();
			}
		});
		this._alert = await this.alertController.create({
			header: header || await this.getResourceAsync("common.alert.header.general"),
			subHeader: message,
			backdropDismiss: backdropDismiss,
			message: subMessage,
			inputs: AppUtility.isArray(inputs, true) ? inputs : undefined,
			buttons: buttons
		});
		await this._alert.present();
	}

	/** Hides the alert box */
	public async hideAlertAsync(onNext?: () => void) {
		if (this._alert !== undefined) {
			await this._alert.dismiss();
			this._alert = undefined;
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	/** Shows the confirmation box  */
	public async showConfirmAsync(message: string = null, onOkClick?: (data?: any) => void, okButtonText?: string, cancelButtonText?: string) {
		await this.showAlertAsync(
			undefined,
			message,
			undefined,
			onOkClick,
			"{{default}}" === okButtonText ? await this.configSvc.getResourceAsync("common.buttons.ok") : okButtonText,
			"{{default}}" === cancelButtonText ? await this.configSvc.getResourceAsync("common.buttons.cancel") : cancelButtonText
		);
	}

	/** Shows the error message (by the alert confirmation box) */
	public async showErrorAsync(error: any, subHeader?: string, postProcess?: (data?: any) => void) {
		const message = AppUtility.isGotWrongAccountOrPasswordException(error)
			? await this.getResourceAsync("common.messages.errors.wrongAccountOrPassword")
			: AppUtility.isGotCaptchaException(error) || AppUtility.isGotOTPException(error)
				? await this.getResourceAsync("common.messages.errors.wrongCaptcha")
				: AppUtility.isNotEmpty(error.Message) ? error.Message : await this.getResourceAsync("common.messages.errors.general");
		await this.showAlertAsync(await this.getResourceAsync("common.alert.header.error"), subHeader, message, postProcess);
	}

	/**
	 * Shows the modal dialog
	 * @param component The component for showing in the modal dialog
	 * @param componentProps The input properties of the component in the modal dialog
	 * @param onDismiss The handler to run when the modal dialog was dismissed
	 * @param backdropDismiss true to dismiss when tap on backdrop
	 * @param swipeToClose true to swipe to close the modal dialog (only available on iOS)
	*/
	public async showModalAsync(component: any, componentProps?: { [key: string]: any }, onDismiss?: (data?: any) => void, backdropDismiss: boolean = false, swipeToClose: boolean = false) {
		await this.hideLoadingAsync(async () => await this.hideModalAsync());
		this._modal = {
			component: await this.modalController.create({
				component: component,
				componentProps: componentProps,
				backdropDismiss: backdropDismiss,
				swipeToClose: swipeToClose,
				presentingElement: swipeToClose ? await this.modalController.getTop() : undefined
			}),
			onDismiss: onDismiss
		};
		await this._modal.component.present();
	}

	/**
	 * Hides (Dismiss) the modal dialog
	 * @param data The data for the onDismiss/onNext handlers
	 * @param onNext The handler to run when the modal dialog was dismissed
	*/
	public async hideModalAsync(data?: any, onNext?: (data?: any) => void) {
		if (this._modal !== undefined) {
			await this._modal.component.dismiss();
			if (this._modal !== undefined && this._modal.onDismiss !== undefined) {
				this._modal.onDismiss(data);
			}
			if (onNext !== undefined) {
				onNext(data);
			}
			this._modal = undefined;
		}
		else if (onNext !== undefined) {
			onNext();
		}
	}

	/** Shows the toast alert message */
	public async showToastAsync(message: string, duration: number = 1000, showCloseButton: boolean = false, closeButtonText: string = "close", atBottom: boolean = false) {
		await this.hideToastAsync();
		this._toast = await this.toastController.create({
			animated: true,
			message: message,
			duration: duration < 1 ? 1000 : duration,
			position: atBottom ? "bottom" : "top",
			buttons: showCloseButton && AppUtility.isNotEmpty(closeButtonText) ? [{ text: closeButtonText, role: "cancel" }] : []
		});
		await this._toast.present();
	}

	/** Hides the toast alert message */
	public async hideToastAsync(onNext?: () => void) {
		if (this._toast !== undefined) {
			await this._toast.dismiss();
			this._toast = undefined;
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

}
