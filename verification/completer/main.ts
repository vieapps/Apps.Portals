import { ChangeDetectionStrategy, Component, Input, NgModule, OnInit, provideZoneChangeDetection } from "@angular/core";
import { BrowserModule, platformBrowser } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { FormGroup } from "@angular/forms";
import { HttpClient, HttpResponse, provideHttpClient, withXhr } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { Observable } from "rxjs";
import { IonApp, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, ModalController, provideIonicAngular } from "@ionic/angular";
import { IonicStorageModule } from "@ionic/storage-angular";
import { AppConfig } from "@app/app.config";
import { AppAPIs } from "@app/components/app.apis";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppFormsModule } from "@app/components/forms.module";
import { AppFormsControlConfig } from "@app/components/forms.objects";
import { provideAppTranslations } from "@app/components/app.i18n";
import { ConfigurationService } from "@app/services/configuration.service";
import { FilesService } from "@app/services/files.service";

const objects = [{ ID: "alpha", Name: "Alpha object", Details: { preserved: true } }, { ID: "beta", Name: "Beta object", Details: { preserved: true } }];
const requests: any[] = [];

@Component({ selector: "completer-fixture-panel", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>Completer verification</ion-title></ion-toolbar></ion-header>
	<ion-content class="ion-padding"><app-form [form]="form" [config]="config" [value]="initial"></app-form>
	<pre data-testid="completer-value">{{ form.value | json }}</pre>
	<pre data-testid="completer-selected">{{ selected | json }}</pre>
	<pre data-testid="completer-requests">{{ requests | json }}</pre>
	<ion-button *ngIf="!inModal" (click)="openModal()">Open completer modal</ion-button>
	<ion-button *ngIf="inModal" (click)="closeModal()">Close completer modal</ion-button></ion-content>` })
class CompleterFixturePanel {
	@Input() inModal = false;
	form = new FormGroup({});
	selected: any;
	requests = requests;
	initial = { Local: "alpha", Unit: "Bến Nghé", Province: "Hồ Chí Minh", Country: "VN" };
	config: AppFormsControlConfig[] = [
		this.lookup("Local", AppCustomCompleter.local(objects, "Name", "Name"), objects[0]),
		this.lookup("Remote", new AppCustomCompleter(term => "lookup?q=" + encodeURIComponent(term), undefined, item => ({ title: item.Name, description: item.ID, originalObject: item }))),
		{ Name: "Addresses", Type: "Lookup", Options: { Type: "Address", Label: "Address fixture", PlaceHolder: "Find address", MinLength: 1, LookupOptions: { AsModal: false, AsCompleter: true } } }
	];
	constructor(private modals: ModalController) {}
	private lookup(name: string, source: AppCustomCompleter, initial?: any): AppFormsControlConfig {
		return { Name: name, Type: "Lookup", Options: { Label: name + " fixture", PlaceHolder: "Find " + name, MinLength: 1, LookupOptions: {
			AsModal: false, AsCompleter: true, Multiple: false, CompleterOptions: {
				DataSource: source, InitialValue: initial, PauseMiliseconds: 50,
				OnSelected: (item, control) => { this.selected = item ? { ...item.originalObject, identity: objects.includes(item.originalObject) } : null; control.setValue(item?.originalObject.ID ?? ""); }
			}
		} } };
	}
	async openModal() { const modal = await this.modals.create({ component: CompleterFixturePanel, componentProps: { inModal: true }, animated: false }); await modal.present(); }
	closeModal() { return this.modals.dismiss(); }
}

@Component({ selector: "app-root", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-app><completer-fixture-panel *ngIf="ready"></completer-fixture-panel></ion-app>` })
class CompleterFixtureRoot implements OnInit {
	ready = false;
	constructor(private config: ConfigurationService) {}
	async ngOnInit() {
		AppConfig.options = AppConfig.defaultOptions;
		AppConfig.app.platform = "Desktop PWA";
		AppConfig.URIs.apis = "https://fixture.invalid/";
		AppConfig.geoMeta.country = "VN";
		AppConfig.geoMeta.provinces.VN = { name: "Vietnam", title: "Vietnam", code: "VN", provinces: [{ name: "Hồ Chí Minh", units: [{ name: "Bến Nghé", title: "Bến Nghé" }, { name: "Tân Định", title: "Tân Định" }] }] };
		await this.config.prepareLanguagesAsync();
		// This entry never bootstraps AppComponent or its remote startup. API traffic is in-memory.
		(AppAPIs as any)._http = new HttpClient({ handle: request => new Observable(observer => {
			const url = new URL(request.url);
			if (url.origin !== "https://fixture.invalid" || url.pathname !== "/lookup") throw new Error("Unexpected fixture URL");
			const record = { term: url.searchParams.get("q"), state: "pending" }; requests.push(record);
			const timer = setTimeout(() => { record.state = "complete"; observer.next(new HttpResponse({ body: { Objects: objects.filter(item => item.Name.toLowerCase().includes(record.term.toLowerCase())) } })); observer.complete(); }, 250);
			return () => { clearTimeout(timer); if (record.state === "pending") record.state = "cancelled"; };
		}) });
		this.ready = true;
	}
}

@NgModule({ declarations: [CompleterFixtureRoot, CompleterFixturePanel],
	imports: [BrowserModule, CommonModule, AppFormsModule, IonicStorageModule.forRoot({ name: "portals-cms-completer-fixtures" }), IonApp, IonButton, IonContent, IonHeader, IonTitle, IonToolbar],
	providers: [provideIonicAngular({ animated: false }), provideRouter([]), provideHttpClient(withXhr()), ...provideAppTranslations(), ConfigurationService, FilesService],
	bootstrap: [CompleterFixtureRoot] })
class CompleterFixtureModule {}

platformBrowser().bootstrapModule(CompleterFixtureModule, { applicationProviders: [provideZoneChangeDetection({ eventCoalescing: false, runCoalescing: false })] }).catch(error => console.error("Completer fixture failed", error));
