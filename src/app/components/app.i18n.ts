import { provideTranslateService } from "@ngx-translate/core";
import { provideTranslateMultiHttpLoader } from "@ngx-translate/http-loader";

export const translationResources = [
	{ prefix: "./assets/i18n/common/", suffix: ".json" },
	{ prefix: "./assets/i18n/users/", suffix: ".json" },
	{ prefix: "./assets/i18n/portals/", suffix: ".json" },
	{ prefix: "./assets/i18n/portals.cms/", suffix: ".json" },
	{ prefix: "./assets/i18n/books/", suffix: ".json" }
];

export function provideAppTranslations() {
	return provideTranslateService({
		loader: provideTranslateMultiHttpLoader({
			resources: translationResources,
			failOnError: false,
			flatten: false,
			useHttpBackend: false,
			onLoadError: failure => console.error("Could not find translation file:", failure.url)
		})
	});
}
