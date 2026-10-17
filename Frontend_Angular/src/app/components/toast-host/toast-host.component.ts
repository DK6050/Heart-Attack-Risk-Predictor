import { Component } from '@angular/core';
import { ToastService } from '../../services/toast.service';

/** Renders the toast stack (one instance, in app.component.html). */
@Component({
  standalone: false,
  selector: 'app-toast-host',
  templateUrl: './toast-host.component.html',
  styleUrls: ['./toast-host.component.css']
})
export class ToastHostComponent {
  readonly icons = { success: 'bi-check-circle-fill', error: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };

  constructor(public toasts: ToastService) {}
}
