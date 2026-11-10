import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EnvironmentInjector, Injectable, Input, NgModule, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { IonButton, IonContent, IonHeader, IonInput, IonSelect, IonSelectOption, IonTitle, IonToolbar, ModalController, NavController } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { FormsFixturePage, FormsFixtureModal } from "./forms.fixture";
import { ArraysLookupFixturePage, LookupFixtureModal } from "./arrays-lookup.fixture";
import { CommonControlsModule } from "@app/controls/common.controls.module";
import { AuthFixtureChooser, AuthFixtureResult } from "./auth.fixture";

let scopeSerial = 0;

@Injectable()
export class UiFixtureScope {
	readonly id = "fixture-scope-" + (++scopeSerial);
	aCreated = 0;
	aInit = 0;
	aEntered = 0;
	aLeft = 0;
	aDestroyed = 0;
	bCreated = 0;
	bDestroyed = 0;
	modalDestroyed = 0;
	events: string[] = [];
}

@Component({
	selector: "verification-modal",
	standalone: false,
	changeDetection: ChangeDetectionStrategy.Eager,
	template: `
		<ion-header><ion-toolbar><ion-title>Fixture modal</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding">
			<p data-testid="modal-message">{{ message }}</p>
			<p data-testid="modal-scope">{{ scope.id }}</p>
			<ion-button (click)="dismiss('save')">Save fixture modal</ion-button>
			<ion-button (click)="dismiss('cancel')">Cancel fixture modal</ion-button>
		</ion-content>
	`
})
export class UiFixtureModal implements OnDestroy {
	@Input() message = "";
	constructor(public scope: UiFixtureScope, private modals: ModalController) {}
	async dismiss(role: string) {
		this.scope.events.push(role);
		await this.modals.dismiss({ scope: this.scope.id, value: role === "save" ? "fixture-saved" : null }, role);
		this.scope.events.push("dismiss-resolved");
	}
	ngOnDestroy() { this.scope.modalDestroyed++; }
}

@Component({
	selector: "verification-page-a",
	standalone: false,
	changeDetection: ChangeDetectionStrategy.Eager,
	template: `
		<ion-header><ion-toolbar><ion-title>UI verification A</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding">
			<p data-testid="page-scope">{{ scope.id }}</p>
			<form [formGroup]="form">
				<ion-input data-testid="text-input" label="Fixture text" formControlName="text"></ion-input>
				<ion-input data-testid="number-input" label="Fixture number" type="number" formControlName="number"></ion-input>
				<ion-select data-testid="select-input" label="Fixture select" interface="popover" formControlName="select">
					<ion-select-option value="one">Option one</ion-select-option>
					<ion-select-option value="two">Option two</ion-select-option>
				</ion-select>
			</form>
			<ion-button (click)="patch()">Patch fixture</ion-button>
			<ion-button (click)="reset()">Reset fixture</ion-button>
			<ion-button (click)="toggleDisabled()">Toggle disabled</ion-button>
			<ion-button (click)="forward()">Go to fixture B</ion-button>
			<ion-button (click)="openModal()">Open fixture modal</ion-button>
			<ion-button (click)="dynamicForms()">Go to dynamic forms</ion-button>
			<ion-button (click)="arraysLookup()">Go to arrays and lookup</ion-button>
			<ion-button (click)="authFixtures()">Go to auth fixtures</ion-button>
			<p data-testid="form-state">status={{ form.status }}; textTouched={{ form.controls.text.touched }}; textDisabled={{ form.controls.text.disabled }}</p>
			<pre data-testid="form-value">{{ form.value | json }}</pre>
			<pre data-testid="form-raw">{{ form.getRawValue() | json }}</pre>
			<p data-testid="lifecycle">aCreated={{ scope.aCreated }}; aInit={{ scope.aInit }}; aEntered={{ scope.aEntered }}; aLeft={{ scope.aLeft }}; aDestroyed={{ scope.aDestroyed }}; bCreated={{ scope.bCreated }}; bDestroyed={{ scope.bDestroyed }}; modalDestroyed={{ scope.modalDestroyed }}</p>
			<pre data-testid="modal-result">{{ modalResult | json }}</pre>
			<p data-testid="modal-events">{{ scope.events.join(' > ') }}</p>
		</ion-content>
	`
})
export class UiFixturePageA implements OnInit, OnDestroy {
	form = new FormGroup({
		text: new FormControl("initial", Validators.required),
		number: new FormControl<number | null>(7),
		select: new FormControl("one")
	});
	modalResult: unknown = null;
	constructor(public scope: UiFixtureScope, private nav: NavController, private modals: ModalController, private injector: EnvironmentInjector) {
		this.scope.aCreated++;
	}
	ngOnInit() { this.scope.aInit++; }
	ionViewDidEnter() { this.scope.aEntered++; }
	ionViewDidLeave() { this.scope.aLeft++; }
	ngOnDestroy() { this.scope.aDestroyed++; }
	patch() {
		this.form.patchValue({ text: "patched", number: 42, select: "two" });
	}
	reset() { this.form.reset({ text: "", number: null, select: "one" }); }
	toggleDisabled() {
		const control = this.form.controls.text;
		control.disabled ? control.enable() : control.disable();
	}
	forward() { return this.nav.navigateForward("/__verification/b"); }
	dynamicForms() { return this.nav.navigateForward("/__verification/forms"); }
	arraysLookup() { return this.nav.navigateForward("/__verification/arrays-lookup"); }
	authFixtures() { return this.nav.navigateForward("/__verification/auth"); }
	async openModal() {
		this.scope.events = ["create"];
		const modal = await this.modals.create({
			component: UiFixtureModal,
			componentProps: { message: "fixture componentProps" },
			injector: this.injector,
			backdropDismiss: false,
			animated: false
		});
		await modal.present();
		this.scope.events.push("present");
		const result = await modal.onDidDismiss();
		this.scope.events.push("didDismiss");
		this.modalResult = { role: result.role, data: result.data };
	}
}

@Component({
	selector: "verification-page-b",
	standalone: false,
	changeDetection: ChangeDetectionStrategy.Eager,
	template: `
		<ion-header><ion-toolbar><ion-title>UI verification B</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding">
			<p data-testid="b-scope">{{ scope.id }}</p>
			<p data-testid="b-count">bCreated={{ scope.bCreated }}</p>
			<ion-button (click)="back()">Back to fixture A</ion-button>
		</ion-content>
	`
})
export class UiFixturePageB implements OnDestroy {
	constructor(public scope: UiFixtureScope, private nav: NavController) { this.scope.bCreated++; }
	back() { return this.nav.navigateBack("/__verification/a"); }
	ngOnDestroy() { this.scope.bDestroyed++; }
}

@NgModule({
	declarations: [UiFixturePageA, UiFixturePageB, UiFixtureModal, FormsFixturePage, FormsFixtureModal, ArraysLookupFixturePage, LookupFixtureModal, AuthFixtureChooser, AuthFixtureResult],
	imports: [
		CommonModule, ReactiveFormsModule, AppFormsModule, CommonControlsModule,
		IonButton, IonContent, IonHeader, IonInput, IonSelect, IonSelectOption, IonTitle, IonToolbar,
		RouterModule.forChild([
			{ path: "auth", component: AuthFixtureChooser },
			{ path: "auth-result", component: AuthFixtureResult },
			{ path: "arrays-lookup", component: ArraysLookupFixturePage },
			{ path: "forms", component: FormsFixturePage },
			{ path: "a", component: UiFixturePageA },
			{ path: "b", component: UiFixturePageB }
		])
	],
	providers: [UiFixtureScope]
})
export class UiFixtureModule {}
