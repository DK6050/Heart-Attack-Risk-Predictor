import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
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
import { HistoryComponent } from './components/history/history.component';
import { MessagesComponent } from './components/messages/messages.component';
import { roleGuard } from './services/auth.http';

const routes: Routes = [
  { path: '', redirectTo: 'index', pathMatch: 'full' },
  { path: 'index', component: HomepageComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'contact', component: ContactComponent },

  // patients: their own health data
  { path: 'dashboard', component: DashboardComponent, canActivate: [roleGuard('user')] },
  { path: 'predict', component: PredictComponent, canActivate: [roleGuard('user')] },
  { path: 'history', component: HistoryComponent, canActivate: [roleGuard('user')] },

  // administrators: training data, users and messages
  { path: 'admindashboard', component: AdmindashboardComponent, canActivate: [roleGuard('admin')] },
  { path: 'usermanagement', component: UsermanagementComponent, canActivate: [roleGuard('admin')] },
  { path: 'dataloader', component: DataloaderComponent, canActivate: [roleGuard('admin')] },
  { path: 'dataset', component: PlanningComponent, canActivate: [roleGuard('admin')] },
  { path: 'messages', component: MessagesComponent, canActivate: [roleGuard('admin')] },

  // old address of the patient list
  { path: 'planning', redirectTo: 'history' },
  { path: '**', redirectTo: 'index' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
