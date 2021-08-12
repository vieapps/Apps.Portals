import { NgModule, Injectable } from "@angular/core";
import { BrowserModule, HammerGestureConfig, HAMMER_GESTURE_CONFIG } from "@angular/platform-browser";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { RouteReuseStrategy } from "@angular/router";

import { IonicModule, IonicRouteStrategy } from "@ionic/angular";
import { IonicStorageModule } from "@ionic/storage";
import { TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { MultiTranslateHttpLoader } from "ngx-translate-multi-http-loader";
import { NgxElectronModule } from "ngx-electron";

import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { Device } from "@ionic-native/device/ngx";
import { Keyboard } from "@ionic-native/keyboard/ngx";
import { AppVersion } from "@ionic-native/app-version/ngx";
import { GoogleAnalytics } from "@ionic-native/google-analytics/ngx";
import { File } from "@ionic-native/file/ngx";
import { FileTransfer } from "@ionic-native/file-transfer/ngx";
import { InAppBrowser } from "@ionic-native/in-app-browser/ngx";
import { Clipboard } from "@ionic-native/clipboard/ngx";

import { AppConfig } from "@app/app.config";
import { AppComponent } from "@app/app.component";
import { AppRoutingModule } from "@app/app.routing.module";
import { AppFormsModule } from "@app/components/forms.module";
import { AppFormsService } from "@app/components/forms.service";
import { AppModulePreloader } from "@app/components/app.preloader";
import { TimePipeModule } from "@app/components/time.pipe";
import { AppReadyGuardService, RegisterGuardService, AuthenticatedGuardService, NotAuthenticatedGuardService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { BooksService } from "@app/services/books.service";

import { AppPreferencesControlModule } from "@app/controls/common/app.preferences.module";
import { FilesProcessorModalPageModule } from "@app/controls/common/file.processor.modal.module";
import { DataLookupModalPageModule } from "@app/controls/portals/data.lookup.modal.module";

// ngx-translate factories
export function HttpLoaderFactory(http: HttpClient) {
	return new MultiTranslateHttpLoader(http, [
		{ prefix: "./assets/i18n/common/", suffix: ".json" },
		{ prefix: "./assets/i18n/users/", suffix: ".json" },
		{ prefix: "./assets/i18n/portals/", suffix: ".json" },
		{ prefix: "./assets/i18n/portals.cms/", suffix: ".json" },
		{ prefix: "./assets/i18n/books/", suffix: ".json" },
	]);
}

// hammerjs config for working with touch gestures
@Injectable()
export class HammerConfig extends HammerGestureConfig {
	options = {
		touchAction: "auto"
	};
}

@NgModule({
	providers: [
		StatusBar,
		SplashScreen,
		Device,
		Keyboard,
		AppVersion,
		File,
		FileTransfer,
		GoogleAnalytics,
		InAppBrowser,
		Clipboard,
		AppFormsService,
		AppModulePreloader,
		AppReadyGuardService,
		RegisterGuardService,
		AuthenticatedGuardService,
		NotAuthenticatedGuardService,
		ConfigurationService,
		AuthenticationService,
		UsersService,
		FilesService,
		PortalsCoreService,
		PortalsCmsService,
		BooksService,
		{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		{ provide: HAMMER_GESTURE_CONFIG, useClass: HammerConfig }
	],
	imports: [
		BrowserModule,
		HttpClientModule,
		NgxElectronModule,
		IonicModule.forRoot(),
		IonicStorageModule.forRoot({ name: AppConfig.app.id + "-db" }),
		TranslateModule.forRoot({ loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}}),
		AppPreferencesControlModule,
		FilesProcessorModalPageModule,
		DataLookupModalPageModule,
		TimePipeModule,
		AppFormsModule,
		AppRoutingModule
	],
	declarations: [AppComponent],
	bootstrap: [AppComponent]
})

export class AppModule {}
