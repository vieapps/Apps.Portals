import { NgZone, provideZoneChangeDetection } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { NavController } from "@ionic/angular";
import { AppModule } from "../../src/app/app.module";
import { ConfigurationService } from "@app/services/configuration.service";
import { UsersService } from "@app/services/users.service";
import { installAuthFixtures } from "./auth.fixture";

// This separate build entry bootstraps the real application and adds fixture routes only here.
platformBrowser().bootstrapModule(AppModule, {
	applicationProviders: [provideZoneChangeDetection({ eventCoalescing: false, runCoalescing: false })]
}).then(module => module.injector.get(NgZone).run(async () => {
	await installAuthFixtures(module.injector.get(ConfigurationService), module.injector.get(UsersService));
	const router = module.injector.get(Router);
	router.resetConfig([
		{ path: "__verification", loadChildren: () => import("./fixture.module").then(value => value.UiFixtureModule) },
		...router.config
	]);
	await module.injector.get(NavController).navigateRoot("/__verification/a");
})).catch(error => console.error("UI verification bootstrap failed", error));
