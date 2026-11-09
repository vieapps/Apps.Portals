import { registerAppIcons } from "@app/components/app.icons";
import { DataItemModalPageModule } from "@app/controls/common/data.item.modal.module";
import { UsersSelectorModalPageModule } from "@app/controls/common/user.selector.modal.module";
import { FilesProcessorModalPageModule } from "@app/controls/common/file.processor.modal.module";
import { DesktopsSelectorModalPageModule } from "@app/controls/portals/desktop.selector.modal.module";
import { ScheduledPublishModalPageModule } from "@app/controls/portals/scheduled.publish.modal.module";
import { DataLookupModalPageModule } from "@app/controls/portals/data.lookup.modal.module";
import { RolesSelectorModalPageModule } from "@app/controls/portals/role.selector.modal.module";
import { AppPreferencesControlModule } from "@app/controls/common/app.preferences.module";
import { TimePipeModule } from "@app/components/time.pipe";
import { AppFormsModule } from "@app/components/forms.module";
import { BooksService } from "@app/services/books.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { NotificationsService } from "@app/services/notifications.service";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { DatePipe } from "@angular/common";
import { provideHttpClient, withXhr } from "@angular/common/http";
import { RouteReuseStrategy } from "@angular/router";
import { IonApp, IonBadge, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonMenu, IonMenuToggle, IonRouterOutlet, IonSplitPane, IonThumbnail, IonTitle, IonToolbar, IonicRouteStrategy, provideIonicAngular } from "@ionic/angular";
import { IonicStorageModule } from "@ionic/storage-angular";
import { AppConfig } from "@app/app.config";
import { AppComponent } from "@app/app.component";
import { AppRoutingModule } from "@app/app.routing.module";
import { provideAppTranslations } from "@app/components/app.i18n";
import { APP_ELECTRON_SERVICE, createElectronService } from "@app/components/app.utility.platform";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService } from "@app/services/files.service";
import { UsersService } from "@app/services/users.service";
import { AppFormsService } from "@app/components/forms.service";
import { AppReadyGuardService, RegisterGuardService, AuthenticatedGuardService, NotAuthenticatedGuardService } from "@app/services/base.service";

registerAppIcons();

@NgModule({
	imports: [
		DataItemModalPageModule,
		UsersSelectorModalPageModule,
		FilesProcessorModalPageModule,
		DesktopsSelectorModalPageModule,
		ScheduledPublishModalPageModule,
		DataLookupModalPageModule,
		RolesSelectorModalPageModule,
		AppPreferencesControlModule,
		TimePipeModule,
		AppFormsModule,
		BrowserModule,
		IonBadge, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonMenu, IonMenuToggle, IonSplitPane, IonThumbnail, IonTitle, IonToolbar,
		IonApp,
		IonRouterOutlet,
		IonicStorageModule.forRoot({ name: AppConfig.app.id + "-db" }),
		AppRoutingModule
	],
	providers: [
		BooksService,
		PortalsCmsService,
		PortalsCoreService,
		NotificationsService,
		provideIonicAngular(),
		{ provide: APP_ELECTRON_SERVICE, useFactory: createElectronService },
		ConfigurationService,
		AuthenticationService,
		FilesService,
		UsersService,
		DatePipe,
		AppFormsService,
		AppReadyGuardService,
		RegisterGuardService,
		AuthenticatedGuardService,
		NotAuthenticatedGuardService,
		...provideAppTranslations(),
		provideHttpClient(withXhr()),
		{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
	],
	declarations: [AppComponent],
	bootstrap: [AppComponent]
})
export class AppModule {}
