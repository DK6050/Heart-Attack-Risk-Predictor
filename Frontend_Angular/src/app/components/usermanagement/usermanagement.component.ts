import { Component, OnInit } from '@angular/core';
import { ApiService, UserRow, errorMessage } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';

@Component({
  standalone: false,
  selector: 'app-usermanagement',
  templateUrl: './usermanagement.component.html',
  styleUrls: ['./usermanagement.component.css']
})
export class UsermanagementComponent implements OnInit {
  users: UserRow[] = [];

  constructor(private api: ApiService, private confirm: ConfirmService, private toast: ToastService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.users().subscribe({
      next: (r) => (this.users = r.rows),
      error: (e) => this.toast.error(errorMessage(e, 'Could not load the users.'))
    });
  }

  initials(user: UserRow): string {
    return (user.uname || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  genderClass(gender: string): string {
    return gender === 'Male' ? 'badge-info' : gender === 'Female' ? 'badge-violet' : 'badge-muted';
  }

  async remove(user: UserRow) {
    const ok = await this.confirm.ask({
      title: 'Delete this user?',
      message: `${user.uname} (${user.email}) will lose access and their ${user.assessments} saved assessment(s) will be deleted. This cannot be undone.`,
      confirmText: 'Delete user',
      danger: true
    });
    if (!ok) return;
    this.api.deleteUser(user.id).subscribe({
      next: () => {
        this.toast.success('User deleted.');
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e, 'Deletion failed.'))
    });
  }
}
