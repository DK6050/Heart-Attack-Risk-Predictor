import { Component, OnInit } from '@angular/core';
import { ApiService, ContactMessage, errorMessage } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';

/** Admin inbox for the messages sent through the public Contact page. */
@Component({
  standalone: false,
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {
  rows: ContactMessage[] = [];
  loaded = false;

  constructor(private api: ApiService, private confirm: ConfirmService, private toast: ToastService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.messages().subscribe({
      next: (r) => {
        this.rows = r.rows;
        this.loaded = true;
      },
      error: (e) => {
        this.loaded = true;
        this.toast.error(errorMessage(e, 'Could not load the messages.'));
      }
    });
  }

  initials(m: ContactMessage): string {
    return (m.name || '?').split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  }

  replyLink(m: ContactMessage): string {
    return `mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Heart Attack Predictor')}`;
  }

  async remove(m: ContactMessage) {
    const ok = await this.confirm.ask({
      title: 'Delete this message?',
      message: `The message from ${m.name} will be permanently removed.`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteMessage(m.id).subscribe({
      next: () => {
        this.toast.success('Message deleted.');
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e, 'Could not delete the message.'))
    });
  }
}
