import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { PreloadingStrategy, Route } from "@angular/router";

@Injectable({ providedIn: "root" })
export class AppModulePreloader implements PreloadingStrategy {
	preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
		return route.data && route.data.preload ? load() : of(null);
	}
}
