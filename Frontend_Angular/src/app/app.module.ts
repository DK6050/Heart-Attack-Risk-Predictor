import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.http';
import { loaderInterceptor } from './services/loader.service';
import { LoaderComponent } from './components/loader/loader.component';
import { ToastHostComponent } from './components/toast-host/toast-host.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { SiteFooterComponent } from './components/site-footer/site-footer.component';
import { RiskGaugeComponent } from './components/risk-gauge/risk-gauge.component';
import { HistoryComponent } from './components/history/history.component';
import { MessagesComponent } from './components/messages/messages.component';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomepageComponent } from './components/homepage/homepage.component';
import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { ContactComponent } from './components/contact/contact.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DataloaderComponent } from './components/dataloader/dataloader.component';
import { PlanningComponent } from './components/planning/planning.component';
import { PredictComponent } from './components/predict/predict.component';
import { UsermanagementComponent } from './components/usermanagement/usermanagement.component';
import { AdmindashboardComponent } from './components/admindashboard/admindashboard.component';
import { SiteHeaderComponent } from './components/site-header/site-header.component';

@NgModule({
  declarations: [
    AppComponent,
    HomepageComponent,
    RegisterComponent,
    LoginComponent,
    ContactComponent,
    DashboardComponent,
    DataloaderComponent,
    PlanningComponent,
    PredictComponent,
    UsermanagementComponent,
    AdmindashboardComponent,
    SiteHeaderComponent,
    LoaderComponent,
    ToastHostComponent,
    ConfirmDialogComponent,
    SiteFooterComponent,
    RiskGaugeComponent,
    HistoryComponent,
    MessagesComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [provideHttpClient(withInterceptors([loaderInterceptor, authInterceptor]))],
  bootstrap: [AppComponent]
})
export class AppModule { }
