import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonInfiniteScroll, IonCheckbox } from "@ionic/angular";
import { HashSet } from "@app/components/app.collections";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppPagination } from "@app/components/app.pagination";
import { AppDataFilter, AppDataPagination } from "@app/components/app.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ServiceLog } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";

@Component({
	selector: "page-logs-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class LogsListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService,
		private changeDetector: ChangeDetectorRef
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	title = "Logs";
	pageNumber = 0;
	pagination: AppDataPagination = {
		TotalRecords: 0,
		TotalPages: 0,
		PageSize: 100,
		PageNumber: 0
	};
	filterBy: AppDataFilter = {};
	selected = new HashSet<string>();

	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild("selectAll", { static: true }) private selectAllCtrl: IonCheckbox;

	get color() {
		return this.configSvc.color;
	}

	get fcolor() {
		return Object.keys(this.filterBy).length > 0 ? "primary" : "dark";
	}

	get locale() {
		return this.configSvc.locale;
	}

	get totalRecords() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get predicate() {
		const correlationID = this.filterBy["CorrelationID"];
		const serviceName = this.filterBy["ServiceName"];
		if (AppUtility.isNotEmpty(correlationID) || AppUtility.isNotEmpty(serviceName)) {
			const predicate: (log: ServiceLog) => boolean = AppUtility.isNotEmpty(correlationID) && AppUtility.isNotEmpty(serviceName)
				? log => log.CorrelationID === correlationID && log.ServiceName === serviceName
				: AppUtility.isNotEmpty(correlationID)
					? log => log.CorrelationID === correlationID
					: log => log.ServiceName === serviceName;
			return predicate;
		}
		return undefined;
	}

	get logs() {
		const predicate = this.predicate;
		return predicate !== undefined ? this.configSvc.serviceLogs.filter(predicate) : this.configSvc.serviceLogs;
	}

	ngOnInit() {
		const account = this.configSvc.getAccount();
		if (this.authSvc.isSystemAdministrator(account) || this.portalsCoreSvc.canManageOrganization(this.portalsCoreSvc.activeOrganization, account)) {
			this.initializeAsync();
		}
		else {
			Promise.all([
				this.appFormsSvc.showToastAsync("Hmmm..."),
				this.configSvc.navigateHomeAsync()
			]);
		}
	}

	ngOnDestroy() {
		this.configSvc.serviceLogs = [];
	}

	private async initializeAsync() {
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.appFormsSvc.showLoadingAsync();
		await this.searchAsync();
	}

	async refreshAsync() {
		this.configSvc.serviceLogs = [];
		this.selected.clear();
		this.selectAllCtrl.checked = false;
		await this.initializeAsync();
	}

	track(index: number, log: ServiceLog) {
		return `${log.ID}@${index}`;
	}

	info(log: ServiceLog) {
		return log !== undefined ? log.Logs.substr(0, 100) + (log.Logs.length > 100 ? "..." : "") : "";
	}

	async onInfiniteScrollAsync() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
			await this.searchAsync(async () => await (this.infiniteScrollCtrl !== undefined ? this.infiniteScrollCtrl.complete() : new Promise<void>(() => {})));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			await this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	onChanged(event: any, selectAll: boolean = false) {
		if (event.detail.checked) {
			if (selectAll) {
				const predicate = this.predicate;
				this.selected = (predicate !== undefined ? this.configSvc.serviceLogs.filter(predicate) : this.configSvc.serviceLogs).map(log => log.ID).toHashSet();
			}
			else {
				this.selected.add(event.detail.value);
			}
		}
		else {
			if (selectAll) {
				this.selected.clear();
			}
			else {
				this.selected.delete(event.detail.value);
			}
		}
	}

	private async searchAsync(onNext?: (data: any) => void) {
		await TrackingUtility.trackAsync({ title: "Browse Logs", category: "ServiceLog", action: "Browse" });
		await this.configSvc.getServiceLogsAsync(
			{
				FilterBy: this.filterBy,
				Pagination: this.pagination
			},
			async data => {
				this.pageNumber++;
				this.pagination = AppPagination.getDefault(data);
				this.pagination.PageNumber = this.pageNumber;
				this.configSvc.serviceLogs = this.configSvc.serviceLogs.concat(data.Objects);
				await this.appFormsSvc.hideLoadingAsync(() => {
					if (onNext !== undefined) {
						onNext(data);
					}
				});
			},
			async _ => await this.appFormsSvc.hideLoadingAsync(async () => await TrackingUtility.trackAsync({ title: "Browse Logs (Error)", category: "ServiceLog", action: "Browse" }))
		);
	}

	async filterAsync() {
		const correlationID = this.filterBy["CorrelationID"];
		const serviceName = this.filterBy["ServiceName"];
		console.log("do filter", this.filterBy);
		await this.appFormsSvc.showAlertAsync(
			"Filter",
			undefined,
			undefined,
			data => {
				if (this.configSvc.isDebug) {
					console.log("<Logs>: Filtered", data);
				}
				if (AppUtility.isNotEmpty(data.CorrelationID)) {
					this.filterBy["CorrelationID"] = data.CorrelationID;
				}
				else {
					delete this.filterBy["CorrelationID"];
				}
				if (AppUtility.isNotEmpty(data.ServiceName)) {
					this.filterBy["ServiceName"] = data.ServiceName;
				}
				else {
					delete this.filterBy["ServiceName"];
				}
				if (this.configSvc.serviceLogs.length < 1 || Object.keys(this.filterBy).length < 1) {
					if (this.infiniteScrollCtrl !== undefined) {
						this.infiniteScrollCtrl.disabled = false;
					}
					this.refreshAsync();
				}
				else {
					this.changeDetector.detectChanges();
				}
			},
			await this.appFormsSvc.getResourceAsync("common.buttons.ok"),
			await this.appFormsSvc.getResourceAsync("common.buttons.cancel"),
			[
				{
					name: "CorrelationID",
					type: "text",
					value: AppUtility.isNotEmpty(correlationID) ? correlationID : undefined,
					placeholder: "Correlation ID"
				},
				{
					name: "ServiceName",
					type: "text",
					value: AppUtility.isNotEmpty(serviceName) ? serviceName : undefined,
					placeholder: "Service Name"
				}
			]
		);
	}

	async viewLogsAsync() {
		if (this.selected.size > 0) {
			await this.configSvc.navigateForwardAsync("/logs/view", { "x-request": AppCrypto.jsonEncode({ ids: this.selected.toArray() }) });
		}
	}

}
