import { Component } from '@angular/core';
import { ApiService, errorMessage } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Component({
  standalone: false,
  selector: 'app-dataloader',
  templateUrl: './dataloader.component.html',
  styleUrls: ['./dataloader.component.css']
})
export class DataloaderComponent {
  busy = false;
  dragging = false;
  file: File | null = null;

  constructor(private api: ApiService, private confirm: ConfirmService, private toast: ToastService) {}

  get sizeLabel(): string {
    if (!this.file) return '';
    const kb = this.file.size / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  }

  onPick(input: HTMLInputElement) {
    this.accept(input.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;
    this.accept(event.dataTransfer?.files?.[0] ?? null);
  }

  /** keeps the file only if it is a .csv of acceptable size */
  private accept(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.toast.error('Only .csv files are supported.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      this.toast.error('The file is larger than 5 MB.');
      return;
    }
    this.file = file;
  }

  removeFile(input: HTMLInputElement, event: Event) {
    event.stopPropagation();
    input.value = '';
    this.file = null;
  }

  loadData(input: HTMLInputElement) {
    if (!this.file) {
      this.toast.info('Please choose a CSV file first.');
      return;
    }
    this.busy = true;
    this.api.uploadCsv(this.file).subscribe({
      next: (resp) => {
        this.busy = false;
        input.value = '';
        this.file = null;
        this.toast.success(resp.message);
      },
      error: (e) => {
        this.busy = false;
        this.toast.error(errorMessage(e, 'Data save failed.'));
      }
    });
  }

  async deleteData() {
    const ok = await this.confirm.ask({
      title: 'Clear the whole training dataset?',
      message: 'This removes ALL training records. Patients will not get predictions until a new dataset is loaded. This cannot be undone.',
      confirmText: 'Clear dataset',
      danger: true
    });
    if (!ok) return;
    this.busy = true;
    this.api.clearData().subscribe({
      next: (resp) => {
        this.busy = false;
        this.toast.success(resp.message);
      },
      error: (e) => {
        this.busy = false;
        this.toast.error(errorMessage(e, 'Data deletion failed.'));
      }
    });
  }
}
