import { Component } from '@angular/core';
import { ApiService, errorMessage } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';

@Component({
  standalone: false,
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent {
  sending = false;

  constructor(private api: ApiService, private toast: ToastService) {}

  private input(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
  }

  validateContact() {
    if (this.sending) return false;
    const uname = this.input('nm').value.trim();
    const phone = this.input('ph').value.trim();
    const email = this.input('em').value.trim();
    const msg = this.input('msg').value.trim();

    const nmpattern = /^[a-zA-Z][a-zA-Z ]*$/;
    const empattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phpattern = /^[6-9]{1}[0-9]{9}$/;

    const problem =
      !nmpattern.test(uname) ? 'Please enter a valid name (letters and spaces only).' :
      !empattern.test(email) ? 'Please enter a valid email address.' :
      !phpattern.test(phone) ? 'Phone number must be 10 digits and start with 6, 7, 8 or 9.' :
      !msg ? 'Please enter a message.' :
      '';
    if (problem) {
      this.toast.error(problem);
      return false;
    }

    this.sending = true;
    this.api.contact({ stname: uname, email, phone, msg }).subscribe({
      next: (resp) => {
        this.sending = false;
        this.toast.success(resp.message);
        ['nm', 'ph', 'em', 'msg'].forEach((id) => (this.input(id).value = ''));
      },
      error: (e) => {
        this.sending = false;
        this.toast.error(errorMessage(e, 'Message could not be saved'));
      }
    });
    return true;
  }
}
