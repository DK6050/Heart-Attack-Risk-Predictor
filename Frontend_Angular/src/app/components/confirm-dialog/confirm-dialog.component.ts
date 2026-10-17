import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';

/** Modal that answers ConfirmService.ask() (one instance, in app.component.html). */
@Component({
  standalone: false,
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  @ViewChild('confirmButton') set confirmButton(el: ElementRef<HTMLButtonElement> | undefined) {
    // move keyboard focus into the dialog as soon as it appears
    if (el) setTimeout(() => el.nativeElement.focus());
  }

  constructor(public confirm: ConfirmService) {}

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.confirm.request$.value) this.confirm.answer(false);
  }
}
