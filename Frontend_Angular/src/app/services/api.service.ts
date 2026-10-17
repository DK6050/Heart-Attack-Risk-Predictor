import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthService, Role } from './auth.service';
import { LOADER_OFF, LOADER_TEXT } from './loader.service';

/** Base URL of the Flask API. */
export const API_URL = 'http://localhost:5000';

/** One factor that pushed a result up or down (impact is in log-odds; only its sign and size matter). */
export interface Factor {
  feature: string;
  impact: number;
}

export interface PredictionResult {
  prediction: 0 | 1; // 1 = prone to heart attack
  riskPercent: number;
  factors: Factor[];
  model: string;
  accuracy: number;
  trainedOn: number;
  /** true when the result was stored in the patient's history */
  saved: boolean;
  assessmentId?: number;
  createdAt?: string;
}

/** A saved risk assessment from a patient's history. */
export interface Assessment {
  id: number;
  createdAt: string;
  inputs: Record<string, number>;
  riskPercent: number;
  prediction: 0 | 1;
  model: string;
  accuracy: number | null;
  factors: Factor[];
}

export interface AdminDashboardStats {
  genders: Record<string, number>;
  /** registered patients */
  total: number;
  asOf: string;
  assessments: {
    total: number;
    levels: { low: number; moderate: number; high: number };
    daily: { date: string; count: number }[];
  };
  dataset: { records: number; prone: number; notProne: number };
  model: { name: string; accuracy: number; trainedOn: number; trainedAt: string } | null;
}

export interface DatasetRow {
  id: number;
  [column: string]: string | number;
}

export interface PlanningPage {
  rows: DatasetRow[];
  total: number;
  page: number;
  size: number;
  /** the `output` value that means "prone to heart attack" */
  diseaseLabel: number;
}

export interface UserRow {
  id: number;
  uname: string;
  email: string;
  phone: string;
  gender: string;
  addr: string;
  assessments: number;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
}

const loaderText = (text: string) => ({ context: new HttpContext().set(LOADER_TEXT, text) });

/** Turns an HTTP failure into a message that is safe to show the user. */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return 'Cannot reach the server. Is the Flask API running on ' + API_URL + '?';
    }
    return e.error?.error ?? fallback;
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  // ---------- public
  register(data: object): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/regdata`, data, loaderText('Creating your account…'));
  }

  login(email: string, pswd: string): Observable<{ role: Role; token: string; name: string }> {
    return this.http
      .post<{ role: Role; token: string; name: string }>(`${API_URL}/logdata`, { email, pswd }, loaderText('Signing you in…'))
      .pipe(tap((r) => this.auth.start(r.token, r.role, r.name)));
  }

  contact(data: object): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/contactdata`, data, loaderText('Sending your message…'));
  }

  // ---------- patient
  predict(data: object): Observable<PredictionResult> {
    return this.http.post<PredictionResult>(`${API_URL}/predictdata`, data, loaderText('Analysing your measurements…'));
  }

  /** `silent` skips the full-screen loader (for background look-ups) */
  assessments(silent = false): Observable<{ rows: Assessment[]; asOf: string }> {
    return this.http.get<{ rows: Assessment[]; asOf: string }>(
      `${API_URL}/assessments`,
      silent ? { context: new HttpContext().set(LOADER_OFF, true) } : loaderText('Loading your history…'));
  }

  deleteAssessment(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/assessments/delete`, { id }, loaderText('Deleting assessment…'));
  }

  // ---------- admin
  adminDashboard(): Observable<AdminDashboardStats> {
    return this.http.get<AdminDashboardStats>(`${API_URL}/angadmindashboard`, loaderText('Loading overview…'));
  }

  planning(page: number, size: number): Observable<PlanningPage> {
    return this.http.get<PlanningPage>(
      `${API_URL}/angplanning`, { params: { page, size }, ...loaderText('Loading records…') });
  }

  deleteRow(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/delind`, { id }, loaderText('Deleting record…'));
  }

  uploadCsv(file: File): Observable<{ message: string }> {
    const form = new FormData();
    form.append('csvfile', file);
    return this.http.post<{ message: string }>(`${API_URL}/dataparser`, form, loaderText('Uploading dataset…'));
  }

  clearData(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/datadelete`, {}, loaderText('Clearing dataset…'));
  }

  users(): Observable<{ rows: UserRow[] }> {
    return this.http.get<{ rows: UserRow[] }>(`${API_URL}/anguserdata`, loaderText('Loading users…'));
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/anguserdele`, { id }, loaderText('Deleting user…'));
  }

  messages(): Observable<{ rows: ContactMessage[] }> {
    return this.http.get<{ rows: ContactMessage[] }>(`${API_URL}/messages`, loaderText('Loading messages…'));
  }

  deleteMessage(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/messages/delete`, { id }, loaderText('Deleting message…'));
  }
}
