import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, errorMessage } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  busy = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // Visiting the login page (including via any "Logout" link) ends the current session.
    this.auth.logout();
  }

  validateLogin() {
    if (this.busy) return;
    const email = (document.getElementById('em') as HTMLInputElement).value.trim();
    const pswd = (document.getElementById('pswd') as HTMLInputElement).value;
    if (!email || !pswd) {
      this.toast.error('Please enter your email and password.');
      return;
    }

    this.busy = true;
    this.api.login(email, pswd).subscribe({
      next: (resp) => {
        this.busy = false;
        this.router.navigate([resp.role === 'admin' ? '/admindashboard' : '/dashboard']);
      },
      error: (e) => {
        this.busy = false;
        this.toast.error(errorMessage(e, 'Login failed'));
      }
    });
  }
}
