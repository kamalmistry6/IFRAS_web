import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {
  ErrorHandler,
  NgModule,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';
import { TitleStrategy } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './auth/interceptors';
import { AuthService } from './auth/services';
import { CoreModule } from './core/core.module';
import { GlobalErrorHandler } from './core/handlers';
import { ErrorInterceptor, LoadingInterceptor } from './core/interceptors';
import { PageTitleStrategyService } from './core/services';
import { LayoutModule } from './layout/layout.module';
import { SharedModule } from './shared/shared.module';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, SharedModule, CoreModule, LayoutModule],
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptorsFromDi()),

    // Runs before the first page: if a refresh token is stored, signs the user back in so a page reload keeps them in.
    provideAppInitializer(() => {
      return firstValueFrom(inject(AuthService).restoreSession());
    }),

    { provide: TitleStrategy, useClass: PageTitleStrategyService },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    Title,

    // The order matters. A request goes through them top to bottom and a
    // response comes back bottom to top, so:
    //   Auth    (innermost) sees raw errors first: refreshes an expired token, or signs out
    //   Error   then turns what is left into a GlobalException (and a toast when useful)
    //   Loading (outermost) wraps the whole call to move the progress bar
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
