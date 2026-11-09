import { provideZoneChangeDetection } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";
import { AppModule } from "./app/app.module";

platformBrowser().bootstrapModule(AppModule, {
	applicationProviders: [provideZoneChangeDetection({
		eventCoalescing: false,
		runCoalescing: false
	})]
}).catch(error => console.error(error));
