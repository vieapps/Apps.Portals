import { Dictionary } from "typescript-collections";
import { List } from "linqts";
import { Injectable } from "@angular/core";
import { AppStorage } from "../components/app.storage";
import { AppRTU, AppMessage } from "../components/app.apis";
import { AppEvents } from "../components/app.events";
import { AppUtility } from "../components/app.utility";
import { PlatformUtility } from "../components/app.utility.platform";
import { AppCustomCompleter } from "../components/app.completer";
import { AppPagination } from "../components/app.pagination";
import { Organization } from "../models/portals.organization";
import { Base as BaseService } from "./base.service";
import { ConfigurationService } from "./configuration.service";

@Injectable()
export class PortalsService extends BaseService {

	constructor(private configSvc: ConfigurationService) {
		super("Portals");
		this.initialize();
	}

	private initialize() {
	}

	public async initializeAsync(onNext?: () => void) {
	}

	public get organizationCompleterDataSource() {
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("organization", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(o => {
				const organization = Organization.deserialize(o);
				return {
					title: organization.Title,
					description: organization.Description,
					originalObject: organization
				};
			})
		);
	}

	public searchOrganization(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("organization", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(o => Organization.update(o));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public searchOrganizationAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.searchAsync(
			super.getSearchURI("organization", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(o => Organization.update(o));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public createOrganizationAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.createAsync(
			super.getURI("organization", body.ID),
			body,
			onNext,
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public getOrganizationAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		const organization = Organization.instances.getValue(id);
		if (organization !== undefined) {
			return new Promise<void>(onNext !== undefined ? () => onNext(organization) : () => {});
		}
		else {
			return super.readAsync(
				super.getURI("organization", id),
				data => {
					Organization.update(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting an organization", error));
					if (onError !== undefined) {
						onError(error);
					}
				}
			);
		}
	}

	public updateOrganizationAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
			super.getURI("organization", body.ID),
			body,
			onNext,
			error => {
				console.error(super.getErrorMessage("Error occurred while updating an organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
	);
	}

	public deleteOrganizationAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.deleteAsync(
			super.getURI("organization", id),
			data => {
				Organization.instances.remove(id);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting an organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

}
