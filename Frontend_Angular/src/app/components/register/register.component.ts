import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, errorMessage } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';

@Component({
  standalone: false,
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  saving = false;

  constructor(private api: ApiService, private router: Router, private toast: ToastService) {}

  private input(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
  }

  clearRegform() {
    ['nm', 'ph', 'em', 'addr', 'pswd'].forEach((id) => (this.input(id).value = ''));
    (document.getElementById('gender') as HTMLSelectElement).selectedIndex = 0;
    this.input('pswd').type = 'password';
  }

  ValidateForm() {
    if (this.saving) return false;
    const uname = this.input('nm').value.trim();
    const phone = this.input('ph').value.trim();
    const email = this.input('em').value.trim();
    const password = this.input('pswd').value;
    const gender = this.input('gender').value;
    const address = this.input('addr').value.trim();

    const nmpattern = /^[a-zA-Z][a-zA-Z ]*$/;
    const phpattern = /^[6-9]{1}[0-9]{9}$/;
    const empattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pswdpattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{5,64}$/;

    const problem =
      uname === '' ? 'Please enter your name.' :
      !nmpattern.test(uname) ? 'Name can contain letters and spaces only.' :
      email === '' ? 'Please enter your email.' :
      !empattern.test(email) ? 'Please enter a valid email address.' :
      phone === '' ? 'Please enter your phone number.' :
      !phpattern.test(phone) ? 'Phone number must be 10 digits and start with 6, 7, 8 or 9.' :
      gender === 'Select Gender' ? 'Please select your gender.' :
      password === '' ? 'Please enter a password.' :
      !pswdpattern.test(password) ? 'Password needs an upper-case letter, a lower-case letter, a digit and at least 5 characters.' :
      '';
    if (problem) {
      this.toast.error(problem);
      return false;
    }

    this.saving = true;
    this.api.register({
      stname: uname, email, phone, addr1: address, gender, pswd: password
    }).subscribe({
      next: (resp) => {
        this.saving = false;
        this.toast.success(resp.message + ' You can sign in now.');
        this.router.navigate(['/login']);
      },
      error: (e) => {
        this.saving = false;
        this.toast.error(errorMessage(e, 'Data not saved'));
      }
    });
    return true;
  }
}
