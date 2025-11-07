import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Custom loader to debug the issue
export class CustomTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) {
    console.log('CustomTranslateLoader constructor called');
  }

  getTranslation(lang: string): Observable<any> {
    const url = `./assets/i18n/${lang}.json`;
    console.log('🔍 CustomTranslateLoader.getTranslation called for lang:', lang);
    console.log('🔍 Loading translations from URL:', url);
    
    return this.http.get<any>(url, { responseType: 'json' }).pipe(
      map((response: any) => {
        console.log('✅ Raw HTTP response received:', response);
        console.log('✅ Response type:', typeof response);
        console.log('✅ Response is array?', Array.isArray(response));
        console.log('✅ Response keys count:', Object.keys(response || {}).length);
        console.log('✅ Response keys:', Object.keys(response || {}));
        
        if (!response || Object.keys(response).length === 0) {
          console.error('❌ WARNING: Response is empty!');
        }
        
        return response || {};
      })
    );
  }
}

export function HttpLoaderFactory(http: HttpClient) {
  return new CustomTranslateLoader(http);
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    // Configure TranslateModule with the loader
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    }).providers!,
  ],
});
