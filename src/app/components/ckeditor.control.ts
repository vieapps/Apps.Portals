import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from "@angular/core";

/** Angular adapter for the self-hosted custom DecoupledEditor build. */
@Component({ selector: "ckeditor", standalone: false, template: '<div #host></div>' })
export class CKEditorControl implements AfterViewInit, OnChanges, OnDestroy {
	@Input() editor: () => Promise<any>;
	@Input() config: any;
	@Input() language: string;
	@Input() data: string;
	@Output() ready = new EventEmitter<any>();
	@Output() change = new EventEmitter<any>();
	@ViewChild("host", { static: true }) host: ElementRef<HTMLElement>;
	editorInstance: any;
	private destroyed = false;
	private viewInitialized = false;
	private editorLanguage: string;
	private refreshTask: Promise<void>;
	private changeListener: () => void;
	private pendingActionsChanged = () => {
		if (this.language !== this.editorLanguage) {
			void this.refreshEditor();
		}
	};

	ngAfterViewInit() {
		this.viewInitialized = true;
		return this.refreshEditor();
	}

	private refreshEditor() {
		return this.refreshTask ??= this.refreshEditorAsync().finally(() => this.refreshTask = undefined);
	}

	private async refreshEditorAsync() {
		let draft: string;
		let boundData: string;
		try {
			const constructor = await this.editor();
			while (!this.destroyed && (!this.editorInstance || this.editorLanguage !== this.language)) {
				const previous = this.editorInstance;
				if (previous) {
					// Let uploads and other pending editor actions finish before replacing the instance.
					if (this.getPendingActions(previous)?.hasAny) {
						return;
					}
					draft = previous.getData();
					boundData = this.data;
					this.detachEditor(previous);
					await this.destroyEditor(previous);
				}
				if (this.destroyed) {
					return;
				}
				const language = this.language;
				const instance = await constructor.create({
					...this.config,
					language: language ?? this.config?.language,
					root: { ...this.config?.root, element: this.host.nativeElement },
					ui: {
						...this.config?.ui,
						overlayContainer: this.config?.ui?.overlayContainer || this.host.nativeElement.closest("ion-modal") || this.host.nativeElement.ownerDocument.body
					}
				});
				if (this.destroyed || language !== this.language) {
					await this.destroyEditor(instance);
					continue;
				}
				// Use a form update received during create, or restore the editor's current draft.
				instance.setData(draft !== undefined && boundData === this.data ? draft : this.data || "");
				this.editorInstance = instance;
				this.editorLanguage = language;
				this.changeListener = () => this.change.emit({ editor: instance });
				instance.model.document.on("change:data", this.changeListener);
				this.getPendingActions(instance)?.on("change:hasAny", this.pendingActionsChanged);
				this.ready.emit(instance);
			}
		}
		catch (error) {
			console.error("Custom CKEditor initialization failed", error);
		}
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes["data"] && this.editorInstance && this.editorInstance.getData() !== (this.data || "")) {
			this.editorInstance.setData(this.data || "");
		}
		if (this.viewInitialized && changes["language"]) {
			void this.refreshEditor();
		}
	}

	ngOnDestroy() {
		this.destroyed = true;
		const instance = this.editorInstance;
		if (instance) {
			this.detachEditor(instance);
			void this.destroyEditor(instance).catch(error => console.error("Custom CKEditor cleanup failed", error));
		}
	}

	private getPendingActions(instance: any) {
		return instance.plugins.has("PendingActions") ? instance.plugins.get("PendingActions") : undefined;
	}

	private detachEditor(instance: any) {
		this.editorInstance = undefined;
		instance.model.document.off("change:data", this.changeListener);
		this.getPendingActions(instance)?.off("change:hasAny", this.pendingActionsChanged);
	}

	private async destroyEditor(instance: any) {
		const toolbar = instance.ui.view.toolbar.element;
		try {
			await instance.destroy();
		}
		finally {
			// Decoupled toolbar is attached by the forms renderer outside the host.
			toolbar?.remove();
		}
	}
}
