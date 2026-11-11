import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, NgModule, OnInit, ViewChild, provideZoneChangeDetection } from "@angular/core";
import { BrowserModule, platformBrowser } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { FormGroup } from "@angular/forms";
import { provideHttpClient, withXhr } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { IonApp, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, provideIonicAngular } from "@ionic/angular";
import { IonicStorageModule } from "@ionic/storage-angular";
import { AppConfig } from "@app/app.config";
import { AppFormsModule } from "@app/components/forms.module";
import { AppFormsService } from "@app/components/forms.service";
import { AppFormsControlConfig } from "@app/components/forms.objects";
import { CKEditorControl } from "@app/components/ckeditor.control";
import { provideAppTranslations } from "@app/components/app.i18n";
import { ConfigurationService } from "@app/services/configuration.service";
import { FilesService } from "@app/services/files.service";

const results: Array<{ name: string; pass: boolean; error?: string }> = [];
const wait = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));
const until = async (condition: () => any, message: string) => { const started = Date.now(); while (!condition()) { if (Date.now() - started > 15000) throw new Error(message); await wait(); } };
const assert = (condition: any, message = "Assertion failed") => { if (!condition) throw new Error(message); };

@Component({ selector: "ckeditor-selector-fixture", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>{{ kind }} fixture</ion-title></ion-toolbar></ion-header>
	<ion-content class="ion-padding"><ion-button (click)="select()">Choose fixture</ion-button><ion-button (click)="cancel()">Cancel fixture</ion-button></ion-content>` })
class SelectorFixture {
	@Input() kind: string;
	constructor(private forms: AppFormsService) {}
	select() { return this.forms.hideModalAsync("https://fixture.invalid/" + this.kind); }
	cancel() { return this.forms.hideModalAsync(); }
}

@Component({ selector: "ckeditor-panel-fixture", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<app-form [form]="form" [config]="config" [value]="initial"></app-form><pre data-testid="form-value">{{ form.value | json }}</pre>` })
class EditorPanel {
	form = new FormGroup({});
	changes = 0;
	selected: string;
	initial = { Body: "<p>Xin chào Việt Nam</p>", Other: "preserved" };
	config: AppFormsControlConfig[];
	constructor(private forms: AppFormsService) {
		const selector = (kind: string) => (onSelected: (value?: string) => void) => this.forms.showModalAsync(SelectorFixture, { kind }, result => { this.selected = kind; onSelected(result); });
		this.config = [
			{ Name: "Body", Type: "TextEditor", Options: { Label: "CKEditor fixture", OnChanged: () => this.changes++ }, Extras: {
				ckEditorSimpleUpload: {}, ckEditorLinkSelector: { content: { selectLink: selector("content") }, file: { selectLink: selector("file") } },
				ckEditorMediaSelector: { selectMedia: (onSelected: (value?: string) => void) => selector("media")(onSelected) }
			} },
			{ Name: "Other", Type: "TextBox", Options: { Label: "Other field" } }
		];
	}
	get editor() { return this.form["_controls"]?.[0]?.controlRef?.["elementRef"]?.editorInstance; }
}

@Component({ selector: "app-root", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-app><ion-header><ion-toolbar><ion-title>CKEditor Angular/Ionic verification</ion-title></ion-toolbar></ion-header>
	<ion-content class="ion-padding"><div data-testid="status">{{ status }}</div><ckeditor-panel-fixture *ngIf="ready && mounted"></ckeditor-panel-fixture>
	<pre data-testid="results">{{ results | json }}</pre></ion-content></ion-app>` })
class EditorFixtureRoot implements OnInit {
	@ViewChild(EditorPanel) panel: EditorPanel;
	ready = false;
	mounted = true;
	status = "Preparing";
	results = results;
	constructor(private config: ConfigurationService) {}
	async ngOnInit() {
		AppConfig.options = { ...AppConfig.defaultOptions, i18n: "vi-VN" };
		AppConfig.app.platform = "Desktop PWA";
		AppConfig.URIs.apis = "https://fixture.invalid/";
		AppConfig.URIs.files = "https://fixture.invalid/";
		await this.config.prepareLanguagesAsync();
		this.ready = true;
		void this.run();
	}
	private async test(name: string, action: () => any) {
		try { await action(); results.push({ name, pass: true }); }
		catch (error) { results.push({ name, pass: false, error: String(error?.stack || error) }); }
		this.status = `${results.filter(result => result.pass).length} pass / ${results.filter(result => !result.pass).length} fail`;
	}
	private async run() {
		try {
			await until(() => this.panel?.editor, "Dynamic form editor did not initialize");
			const panel = this.panel;
			const editor = panel.editor;
			await this.test("Real form renderer initializes latest editor in Vietnamese", () => { assert(editor.locale.uiLanguage === "vi"); assert(editor.getData() === panel.initial.Body); assert(panel.changes === 0, "False initial change"); assert(editor.config.get("licenseKey") === "GPL"); });
			await this.test("Form Extras preserve selectors and upload header contract", () => { assert(typeof editor.config.get("link.selector.content.selectLink") === "function"); assert(typeof editor.config.get("media.selector.selectMedia") === "function"); assert(editor.config.get("simpleUpload.uploadUrl") === "https://fixture.invalid/one.image"); assert(editor.config.get("simpleUpload.headers")["X-Fixture"] === "fixture-only"); assert(!editor.plugins.has("PageBreak") && !editor.plugins.has("CodeBlock") && !editor.plugins.has("Highlight")); });
			await this.test("Programmatic form patch reaches editor without loop", async () => { panel.form.patchValue({ Body: "<p>Patched draft</p>" }); await until(() => editor.getData() === "<p>Patched draft</p>", "Patch not reflected"); const changes = panel.changes; await wait(100); assert(panel.changes === changes, "Change loop"); assert(panel.form.value["Other"] === "preserved"); });
			await this.test("Editor change reaches form and metadata callback", async () => { editor.model.change(writer => { const paragraph = editor.model.document.getRoot().getChild(0); writer.insertText(" USER", paragraph, "end"); writer.setSelection(paragraph, "in"); }); await until(() => panel.form.value["Body"].includes("USER"), "Form value not updated"); assert(panel.changes > 0); });
			await this.test("Popup content button opens Ionic modal and delivers callback", async () => {
				editor.ui.componentFactory.create("link").fire("execute");
				const form = editor.plugins.get("LinkUI").formView;
				const button = [...form.element.querySelectorAll("button")].find((node: HTMLElement) => node.textContent.trim() === editor.t("Internal content")) as HTMLElement;
				assert(button, "Content selector not in popup"); button.click();
				await until(() => document.querySelector("ion-modal ckeditor-selector-fixture ion-button"), "Selector modal missing");
				(document.querySelector("ion-modal ckeditor-selector-fixture ion-button") as HTMLElement).click();
				await until(() => panel.form.value["Body"].includes("https://fixture.invalid/content"), "Callback did not update form");
				assert(panel.selected === "content"); assert(panel.form.value["Other"] === "preserved");
			});
			await this.test("File selector cancellation keeps form HTML", async () => {
				editor.ui.componentFactory.create("link").fire("execute");
				const form = editor.plugins.get("LinkUI").formView;
				if (!editor.plugins.get("ContextualBalloon").hasView(form)) editor.ui.componentFactory.create("editLink").fire("execute");
				const before = panel.form.value["Body"];
				([...form.element.querySelectorAll("button")].find((node: HTMLElement) => node.textContent.trim() === editor.t("Uploaded file")) as HTMLElement).click();
				await until(() => document.querySelector("ion-modal ckeditor-selector-fixture"), "File modal missing");
				const buttons = document.querySelectorAll("ion-modal ckeditor-selector-fixture ion-button"); (buttons[1] as HTMLElement).click();
				await until(() => !document.querySelector("ion-modal"), "Modal did not dismiss"); assert(panel.form.value["Body"] === before);
			});
			await this.test("Live language switching follows UI preferences and preserves the draft", async () => {
				const account = AppConfig.session.account;
				AppConfig.session.account = { profile: { Language: "vi-VN" } } as typeof account;
				const draft = editor.getData();
				const changes = panel.changes;
				const pending = editor.plugins.get("PendingActions");
				const upload = pending.add("Fixture upload");
				try {
					await this.config.changeLanguageAsync("en-US", false);
					await wait(100);
					assert(panel.editor === editor, "Editor was replaced during a pending action");
					pending.remove(upload);
					await until(() => panel.editor?.locale.uiLanguage === "en", "English editor missing");
					assert(this.panel === panel && editor.state === "destroyed");
					assert(panel.editor.t("Internal content") === "Internal content" && !panel.editor.isReadOnly);
					assert(panel.editor.getData() === draft && panel.form.value["Body"] === draft);
					assert(panel.changes === changes && panel.form.value["Other"] === "preserved");
					assert(document.querySelectorAll("ckeditor .ck-toolbar").length === 1);
					await this.config.changeLanguageAsync("vi-VN", false);
					await until(() => panel.editor?.locale.uiLanguage === "vi", "Vietnamese editor missing");
					assert(panel.editor.t("Internal content") === "Nội dung nội bộ");
					assert(panel.editor.getData() === draft && panel.changes === changes);
				}
				finally {
					AppConfig.session.account = account;
					if (editor.state !== "destroyed" && pending.hasAny) pending.remove(upload);
				}
			});
			await this.test("Destroy form removes detached toolbar and editor", async () => { const current = panel.editor; const toolbar = current.ui.view.toolbar.element; this.mounted = false; await until(() => current.state === "destroyed", "Editor not destroyed"); assert(!toolbar.isConnected); assert(!document.querySelector(".ck-link-form")); });
			await this.test("Recreate form in English without duplicate engine", async () => { await this.config.changeLanguageAsync("en-US", false); this.mounted = true; await until(() => this.panel?.editor && this.panel !== panel, "English editor missing"); assert(this.panel.editor.locale.uiLanguage === "en"); assert(this.panel.editor.t("Internal content") === "Internal content"); assert(!this.panel.editor.isReadOnly); });
			await this.test("Async adapter init uses latest input; initial ready emits once", async () => {
				const control = new CKEditorControl(); const host = document.createElement("div"); document.body.append(host); control.host = new ElementRef(host); control.data = "<p>Before</p>";
				let release: (value: any) => void; const pending = new Promise(resolve => release = resolve); const facade = (await import("../../src/app/components/ckeditor/ckeditor.js")).default;
				control.editor = () => pending; let ready = 0, changes = 0; control.ready.subscribe(() => ready++); control.change.subscribe(() => changes++); const loading = control.ngAfterViewInit(); control.data = "<p>Latest</p>"; release(facade); await loading; assert(control.editorInstance.getData() === control.data); assert(ready === 1 && changes === 0); const instance = control.editorInstance; control.ngOnDestroy(); await until(() => instance.state === "destroyed", "Adapter not destroyed"); host.remove();
			});
			await this.test("Destroy before editor import prevents creation", async () => {
				const control = new CKEditorControl(); let release: (value: any) => void; let creates = 0; control.editor = () => new Promise(resolve => release = resolve); const loading = control.ngAfterViewInit(); control.ngOnDestroy(); release({ create: () => creates++ }); await loading; assert(creates === 0);
			});
			await this.test("Destroy during create cleans late editor instance", async () => {
				const control = new CKEditorControl(); const host = document.createElement("div"); control.host = new ElementRef(host); let release: (value: any) => void; let destroyed = 0; const toolbar = document.createElement("div"); document.body.append(toolbar);
				control.editor = async () => ({ create: () => new Promise(resolve => release = resolve) }); const loading = control.ngAfterViewInit(); await until(() => release, "Create not reached"); control.ngOnDestroy(); release({ ui: { view: { toolbar: { element: toolbar } } }, destroy: async () => { destroyed++; } }); await loading; assert(destroyed === 1 && !toolbar.isConnected);
			});
		}
		catch (error) { results.push({ name: "fatal", pass: false, error: String(error?.stack || error) }); }
		this.status = `DONE: ${results.filter(result => result.pass).length} pass / ${results.filter(result => !result.pass).length} fail`;
	}
}

@NgModule({ declarations: [EditorFixtureRoot, EditorPanel, SelectorFixture],
	imports: [BrowserModule, CommonModule, AppFormsModule, IonicStorageModule.forRoot({ name: "portals-ckeditor-fixtures" }), IonApp, IonButton, IonContent, IonHeader, IonTitle, IonToolbar],
	providers: [provideIonicAngular({ animated: false }), provideRouter([]), provideHttpClient(withXhr()), ...provideAppTranslations(), ConfigurationService,
		{ provide: FilesService, useValue: { getUploadHeaders: () => ({ "X-Fixture": "fixture-only" }) } }],
	bootstrap: [EditorFixtureRoot] })
class EditorFixtureModule {}
platformBrowser().bootstrapModule(EditorFixtureModule, { applicationProviders: [provideZoneChangeDetection({ eventCoalescing: false, runCoalescing: false })] }).catch(error => console.error("CKEditor fixture failed", error));
