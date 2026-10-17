import { Component, OnInit } from '@angular/core';
import { ApiService, DatasetRow, errorMessage } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';

interface Column {
  key: string;
  label: string;
  /** tooltip explaining the abbreviation */
  title: string;
}

@Component({
  standalone: false,
  selector: 'app-planning',
  templateUrl: './planning.component.html',
  styleUrls: ['./planning.component.css']
})
export class PlanningComponent implements OnInit {
  /** all dataset columns except `sex` and `output`, which are shown as badges */
  readonly columns: Column[] = [
    { key: 'age', label: 'Age', title: 'Age in years' },
    { key: 'sex', label: 'Sex', title: 'Sex' },
    { key: 'cp', label: 'Chest pain', title: 'Chest pain type (0 asymptomatic, 1 atypical, 2 non-anginal, 3 typical)' },
    { key: 'trtbps', label: 'Rest BP', title: 'Resting blood pressure (mm Hg)' },
    { key: 'chol', label: 'Cholesterol', title: 'Serum cholesterol (mg/dl)' },
    { key: 'fbs', label: 'Fasting sugar', title: 'Fasting blood sugar above 120 mg/dl (1 = yes)' },
    { key: 'restecg', label: 'Rest ECG', title: 'Resting ECG result (0 hypertrophy, 1 normal, 2 ST-T abnormality)' },
    { key: 'thalachh', label: 'Max HR', title: 'Maximum heart rate achieved' },
    { key: 'exng', label: 'Ex. angina', title: 'Exercise induced angina (1 = yes)' },
    { key: 'oldpeak', label: 'Oldpeak', title: 'ST depression induced by exercise' },
    { key: 'slp', label: 'ST slope', title: 'Slope of the peak exercise ST segment (0 down, 1 flat, 2 up)' },
    { key: 'caa', label: 'Vessels', title: 'Number of major blood vessels' },
    { key: 'thall', label: 'Thal', title: 'Thalassemia result (1 fixed defect, 2 normal, 3 reversible defect)' }
  ];
  readonly size = 12;
  rows: DatasetRow[] = [];
  page = 1;
  total = 0;
  /** the `output` value that means "prone to heart attack" */
  diseaseLabel = 0;

  constructor(private api: ApiService, private confirm: ConfirmService, private toast: ToastService) {}

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total / this.size));
  }

  get from(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.size + 1;
  }

  get to(): number {
    return Math.min(this.page * this.size, this.total);
  }

  ngOnInit() {
    this.load();
  }

  atRisk(row: DatasetRow): boolean {
    return Number(row['output']) === this.diseaseLabel;
  }

  load(page = this.page) {
    this.api.planning(page, this.size).subscribe({
      next: (r) => {
        this.total = r.total;
        this.diseaseLabel = r.diseaseLabel;
        // the last page may have vanished after deletions
        if (r.rows.length === 0 && r.total > 0 && page > 1) {
          this.load(this.lastPage);
          return;
        }
        this.rows = r.rows;
        this.page = page;
      },
      error: (e) => this.toast.error(errorMessage(e, 'Could not load the records.'))
    });
  }

  async remove(row: DatasetRow) {
    const ok = await this.confirm.ask({
      title: 'Delete this training record?',
      message: `Record #${row.id} will be removed from the training data and the model will retrain without it. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteRow(row.id).subscribe({
      next: () => {
        this.toast.success('Record deleted.');
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e, 'Deletion failed.'))
    });
  }
}
