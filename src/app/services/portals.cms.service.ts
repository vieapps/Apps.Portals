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
export class PortalsCMSService extends BaseService {

	constructor(
		private configSvc: ConfigurationService
	) {
		super("Portals");
	}

}
