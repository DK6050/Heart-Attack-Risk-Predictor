import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from './api.service';
import { authInterceptor } from './auth.http';
import { AuthService } from './auth.service';

describe('auth', () => {
  let auth: AuthService;
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('stores and clears the session', () => {
    expect(auth.role).toBeNull();
    auth.start('tok', 'admin');
    expect(auth.token).toBe('tok');
    expect(auth.role).toBe('admin');
    auth.logout();
    expect(auth.token).toBeNull();
  });

  it('adds the bearer token to API requests only', () => {
    auth.start('tok', 'user');
    http.get(`${API_URL}/angdashboard`).subscribe();
    expect(backend.expectOne(`${API_URL}/angdashboard`).request.headers.get('Authorization')).toBe('Bearer tok');
    http.get('https://example.com/x').subscribe();
    expect(backend.expectOne('https://example.com/x').request.headers.has('Authorization')).toBeFalse();
  });

  it('logs out on a 401 from the API', () => {
    auth.start('tok', 'user');
    http.get(`${API_URL}/angplanning`).subscribe({ error: () => undefined });
    backend.expectOne(`${API_URL}/angplanning`).flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.token).toBeNull();
  });
});
