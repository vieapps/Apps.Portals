import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";

@Component({
	selector: "verification-forms-modal", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>Forms service modal</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding"><p>{{ message }}</p><ion-button (click)="save()">Save forms modal</ion-button></ion-content>`
})
export class FormsFixtureModal {
	@Input() message: string;
	constructor(private forms: AppFormsService) {}
	save() { return this.forms.hideModalAsync({ saved: true }); }
}

@Component({
	selector: "verification-forms-page", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>Dynamic forms verification</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding">
			<app-form [form]="form" [config]="config" [value]="initial"
				(init)="events.push('init')" (submit)="events.push('submit')" (refreshCaptcha)="events.push('captcha')"></app-form>
			<ion-button (click)="patch()">Patch dynamic form</ion-button>
			<ion-button (click)="openModal()">Open forms service modal</ion-button>
			<ion-button (click)="loading()">Show forms loading</ion-button>
			<pre data-testid="dynamic-value">{{ form.value | json }}</pre>
			<p data-testid="dynamic-status">{{ form.status }}</p>
			<p data-testid="dynamic-events">{{ events.join(' > ') }}</p>
			<pre data-testid="dynamic-modal-result">{{ modalResult | json }}</pre>
		</ion-content>`
})
export class FormsFixturePage {
	form = new FormGroup({});
	events: string[] = [];
	modalResult: any = null;
	initial = { Title: "fixture title", Count: 7, Notes: "fixture notes", Choice: "a", Enabled: false, Locked: "keep-locked", ID: "keep-id", Captcha: "ABC", Details: { City: "Fixture city" } };
	config: AppFormsControlConfig[] = [
		{ Name: "Title", Required: true, Options: { Label: "Fixture title", PlaceHolder: "Fixture title", MinLength: 2 } },
		{ Name: "Count", Options: { Type: "number", Label: "Fixture count", PlaceHolder: "Fixture count" } },
		{ Name: "Notes", Type: "TextArea", Options: { Label: "Fixture notes", PlaceHolder: "Fixture notes" } },
		{ Name: "Choice", Type: "Select", Options: { Label: "Fixture choice", SelectOptions: { Values: [{ Value: "a", Label: "Alpha" }, { Value: "b", Label: "Beta" }] }, OnChanged: () => this.events.push("choice") } },
		{ Name: "Enabled", Type: "YesNo", Options: { Type: "toggle", Label: "Fixture enabled", OnChanged: () => this.events.push("enabled") } },
		{ Name: "Locked", Options: { Label: "Fixture locked", PlaceHolder: "Fixture locked", Disabled: true } },
		{ Name: "ID", Hidden: true, Required: true },
		{ Name: "Captcha", Type: "Captcha", Options: { Label: "Fixture captcha", PlaceHolder: "Fixture captcha" } },
		{ Name: "Details", SubControls: { Controls: [{ Name: "City", Options: { Label: "Fixture city", PlaceHolder: "Fixture city" } }] } },
		{ Name: "Buttons", Type: "Buttons", SubControls: { Controls: [{ Name: "Save", Type: "Button", Options: { Label: "Fixture action", ButtonOptions: { OnClick: () => this.events.push("action") } } }] } }
	];
	constructor(private forms: AppFormsService) {}
	patch() { this.form.patchValue({ Title: "patched title", Count: 42, Choice: "b", Details: { City: "Patched city" } }); }
	openModal() { return this.forms.showModalAsync(FormsFixtureModal, { message: "feature service props" }, value => { this.modalResult = value; this.events.push("modal-dismiss"); }); }
	async loading() { await this.forms.showLoadingAsync("fixture loading"); await this.forms.hideLoadingAsync(() => this.events.push("loading-done")); }
}
