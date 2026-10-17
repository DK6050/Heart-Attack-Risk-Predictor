import { Component, OnInit } from '@angular/core';
import { ApiService, Assessment, PredictionResult, errorMessage } from '../../services/api.service';
import { Advice, FEATURE_NAMES, adviceFor, formatInput, riskLevel } from '../../services/clinical';
import { PredictStateService } from '../../services/predict-state.service';
import { ToastService } from '../../services/toast.service';

interface Option {
  value: string;
  label: string;
}

interface Field {
  id: string;
  /** full label shown above the field */
  label: string;
  /** short name used inside messages */
  name: string;
  /** one-line explanation of what to enter */
  hint: string;
  kind: 'number' | 'select';
  // number fields (ranges must match RANGES in Flask_App/app.py)
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
  placeholder?: string;
  // select fields
  options?: Option[];
}

@Component({
  standalone: false,
  selector: 'app-predict',
  templateUrl: './predict.component.html',
  styleUrls: ['./predict.component.css']
})
export class PredictComponent implements OnInit {
  readonly fields: Field[] = [
    {
      id: 'age', label: 'Age (years)', name: 'Age', kind: 'number', min: 1, max: 120, decimals: 0, unit: ' years',
      placeholder: 'e.g. 54', hint: "Patient's age as a whole number, 1 – 120."
    },
    {
      id: 'sex', label: 'Sex', name: 'Sex', kind: 'select', hint: 'Biological sex of the patient.',
      options: [{ value: '1', label: 'Male' }, { value: '0', label: 'Female' }]
    },
    {
      id: 'cp', label: 'Chest pain type', name: 'Chest pain type', kind: 'select',
      hint: 'The kind of chest pain the patient experiences.',
      options: [
        { value: '0', label: 'No chest pain (asymptomatic)' },
        { value: '1', label: 'Atypical angina' },
        { value: '2', label: 'Non-anginal pain' },
        { value: '3', label: 'Typical angina' }
      ]
    },
    {
      id: 'trtbps', label: 'Resting blood pressure (mm Hg)', name: 'Resting blood pressure', kind: 'number',
      min: 50, max: 300, decimals: 0, unit: ' mm Hg', placeholder: 'e.g. 120',
      hint: 'Top (systolic) blood pressure measured at rest, 50 – 300. Normal is about 120.'
    },
    {
      id: 'chol', label: 'Cholesterol (mg/dl)', name: 'Cholesterol', kind: 'number',
      min: 100, max: 600, decimals: 0, unit: ' mg/dl', placeholder: 'e.g. 200',
      hint: 'Total serum cholesterol from a blood test, 100 – 600. Below 200 is desirable.'
    },
    {
      id: 'fbs', label: 'Fasting blood sugar above 120 mg/dl?', name: 'Fasting blood sugar', kind: 'select',
      hint: 'Was the blood sugar level above 120 mg/dl after fasting?',
      options: [{ value: '1', label: 'Yes (above 120 mg/dl)' }, { value: '0', label: 'No (120 mg/dl or lower)' }]
    },
    {
      id: 'restecg', label: 'Resting ECG result', name: 'Resting ECG result', kind: 'select',
      hint: 'Result of the electrocardiogram (heart tracing) taken at rest.',
      options: [
        { value: '1', label: 'Normal' },
        { value: '2', label: 'ST-T wave abnormality' },
        { value: '0', label: 'Left ventricular hypertrophy (thickened heart wall)' }
      ]
    },
    {
      id: 'thalachh', label: 'Maximum heart rate achieved (beats/min)', name: 'Maximum heart rate', kind: 'number',
      min: 50, max: 250, decimals: 0, unit: ' bpm', placeholder: 'e.g. 150',
      hint: 'Highest heart rate reached during the exercise test, 50 – 250.'
    },
    {
      id: 'exng', label: 'Chest pain during exercise?', name: 'Exercise-induced chest pain', kind: 'select',
      hint: 'Did exercise bring on chest pain (exercise-induced angina)?',
      options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]
    },
    {
      id: 'oldpeak', label: 'ST depression after exercise (oldpeak)', name: 'ST depression (oldpeak)', kind: 'number',
      min: 0, max: 10, decimals: 1, unit: '', placeholder: 'e.g. 1.5',
      hint: 'ST-segment drop on the exercise ECG compared with rest, 0 – 10 (one decimal). Enter 0 if none.'
    },
    {
      id: 'slp', label: 'ST segment slope at peak exercise', name: 'ST segment slope', kind: 'select',
      hint: 'Shape of the ST segment on the ECG at peak exercise.',
      options: [
        { value: '2', label: 'Upsloping' },
        { value: '1', label: 'Flat' },
        { value: '0', label: 'Downsloping' }
      ]
    },
    {
      id: 'caa', label: 'Major blood vessels blocked (0 – 3)', name: 'Number of blocked vessels', kind: 'select',
      hint: 'Number of major vessels (0 – 3) showing narrowing or blockage on a fluoroscopy scan.',
      options: [
        { value: '0', label: '0 vessels' },
        { value: '1', label: '1 vessel' },
        { value: '2', label: '2 vessels' },
        { value: '3', label: '3 vessels' }
      ]
    },
    {
      id: 'thall', label: 'Thalassemia blood test result', name: 'Thalassemia result', kind: 'select',
      hint: 'Result of the thallium stress test (blood flow to the heart).',
      options: [
        { value: '2', label: 'Normal' },
        { value: '1', label: 'Fixed defect' },
        { value: '3', label: 'Reversible defect' }
      ]
    }
  ];

  /** the form is shown as three cards */
  readonly groups = [
    { title: 'Patient profile', sub: 'Basic details about the patient.', icon: 'bi-person-heart', ids: ['age', 'sex'] },
    { title: 'Vitals & blood tests', sub: 'Measurements taken at rest and from lab work.', icon: 'bi-droplet-half', ids: ['trtbps', 'chol', 'fbs', 'thalachh'] },
    { title: 'Cardiac tests', sub: 'Chest-pain history plus ECG and stress-test findings.', icon: 'bi-activity', ids: ['cp', 'restecg', 'exng', 'oldpeak', 'slp', 'caa', 'thall'] }
  ].map((g) => ({ ...g, fields: g.ids.map((id) => this.fields.find((f) => f.id === id)!) }));

  /** entered values - kept in PredictStateService so they survive navigation until logout */
  values: Record<string, string>;
  /** current validation error per field (empty string = valid) */
  errors: Record<string, string> = {};
  /** message shown immediately when a keystroke was rejected */
  blocked: Record<string, string> = {};
  private blurred = new Set<string>();
  private blockedTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  submitted = false;

  busy = false;
  formError = '';

  /** the patient's previous assessment, offered as a shortcut to fill the form */
  last: Assessment | null = null;

  constructor(private api: ApiService, private state: PredictStateService, private toast: ToastService) {
    this.values = this.state.values;
    this.fields.forEach((f) => (this.errors[f.id] = this.check(f)));
  }

  ngOnInit() {
    this.api.assessments(true).subscribe({ next: (r) => (this.last = r.rows[0] ?? null), error: () => undefined });
  }

  /** last prediction - also kept until logout */
  get result(): PredictionResult | null {
    return this.state.result;
  }
  set result(value: PredictionResult | null) {
    this.state.result = value;
    this.state.save();
  }

  /** list items are identified by position, so the lists below are not rebuilt on every change-detection pass */
  trackIndex = (index: number) => index;

  // ---------- result presentation ----------
  get risk(): number {
    return this.result?.riskPercent ?? 0;
  }

  /** colour band of the result card */
  get level(): 'low' | 'moderate' | 'high' {
    return riskLevel(this.risk);
  }

  /** the measurements that influenced the result most, with a bar width relative to the strongest one */
  get factorRows(): { label: string; value: string; raises: boolean; width: number }[] {
    const factors = this.result?.factors ?? [];
    const max = Math.max(...factors.map((f) => Math.abs(f.impact)), 0.0001);
    return factors.slice(0, 5).map((f) => ({
      label: FEATURE_NAMES[f.feature] ?? f.feature,
      value: formatInput(f.feature, this.values[f.feature] ?? ''),
      raises: f.impact > 0,
      width: Math.max(8, Math.round((Math.abs(f.impact) / max) * 100))
    }));
  }

  get advice(): Advice[] {
    if (!this.result) return [];
    const inputs: Record<string, string> = {};
    this.fields.forEach((f) => (inputs[f.id] = this.values[f.id] ?? ''));
    return adviceFor(inputs, this.level);
  }

  // ---------- validation ----------
  private rangeText(f: Field): string {
    return `${f.name} must be between ${f.min} and ${f.max}${f.unit ?? ''}.`;
  }

  private check(f: Field): string {
    const raw = this.values[f.id] ?? '';
    if (raw === '') {
      return f.kind === 'number' ? `Please enter a value for ${f.name}.` : `Please select an option for ${f.name}.`;
    }
    if (f.kind === 'select') return '';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Please enter a valid number.';
    if (n < f.min! || n > f.max!) return this.rangeText(f);
    return '';
  }

  /** current text of a field ('' when nothing has been entered) */
  valueOf(f: Field): string {
    return this.values[f.id] ?? '';
  }

  /** the message to display under a field, if any */
  message(f: Field): string {
    if (this.blocked[f.id]) return this.blocked[f.id];
    return this.blurred.has(f.id) || this.submitted ? this.errors[f.id] : '';
  }

  // ---------- events ----------
  onInput(f: Field, event: Event) {
    const el = event.target as HTMLInputElement;
    const previous = this.values[f.id] ?? '';
    let raw = el.value;

    // keep only digits (and one decimal point where decimals are allowed)
    raw = f.decimals ? raw.replace(/[^\d.]/g, '') : raw.replace(/\D/g, '');
    if (f.decimals) {
      const [whole, ...rest] = raw.split('.');
      raw = rest.length ? `${whole}.${rest.join('').slice(0, f.decimals)}` : whole;
    }
    raw = raw.replace(/^0+(?=\d)/, '');

    this.clearBlocked(f.id);
    if (raw !== '' && Number(raw) > f.max!) {
      // a value above the maximum can never become valid, so it is not accepted
      raw = previous;
      this.blocked[f.id] = `${f.name} cannot be more than ${f.max}${f.unit ?? ''} (allowed range: ${f.min} – ${f.max}).`;
      // the field still holds a valid value, so this notice only flashes briefly
      this.blockedTimers[f.id] = setTimeout(() => this.clearBlocked(f.id), 2500);
    }

    el.value = raw;
    this.values[f.id] = raw;
    this.changed(f);
  }

  onSelect(f: Field, event: Event) {
    this.values[f.id] = (event.target as HTMLSelectElement).value;
    this.blurred.add(f.id);
    this.changed(f);
  }

  onBlur(f: Field) {
    this.clearBlocked(f.id);
    this.blurred.add(f.id);
  }

  private clearBlocked(id: string) {
    clearTimeout(this.blockedTimers[id]);
    delete this.blockedTimers[id];
    delete this.blocked[id];
  }

  private changed(f: Field) {
    this.errors[f.id] = this.check(f);
    this.result = null; // inputs changed: the old result no longer applies (also saves the values)
    if (this.formError && this.fields.every((x) => !this.errors[x.id])) this.formError = '';
  }

  // ---------- actions ----------
  predictData() {
    if (this.busy) return;
    this.submitted = true;
    this.result = null;
    this.fields.forEach((f) => (this.errors[f.id] = this.check(f)));

    const firstBad = this.fields.find((f) => this.errors[f.id]);
    if (firstBad) {
      this.formError = 'Please correct the highlighted fields before predicting.';
      const el = document.getElementById(firstBad.id);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
      return;
    }
    this.formError = '';

    const payload: Record<string, number> = {};
    this.fields.forEach((f) => (payload[f.id] = Number(this.values[f.id])));

    this.busy = true;
    this.api.predict(payload).subscribe({
      next: (r) => {
        this.busy = false;
        this.result = r;
        if (r.saved) {
          this.toast.success('Assessment saved to your history.');
          this.api.assessments(true).subscribe({ next: (h) => (this.last = h.rows[0] ?? null), error: () => undefined });
        }
        setTimeout(() => document.getElementById('result')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      },
      error: (e) => {
        this.busy = false;
        this.formError = errorMessage(e, 'Prediction failed. Please try again.');
      }
    });
  }

  /** fill the form with the values of the previous assessment (nothing is submitted) */
  useLast() {
    if (!this.last) return;
    this.state.clear();
    this.values = this.state.values;
    this.fields.forEach((f) => (this.values[f.id] = String(this.last!.inputs[f.id])));
    this.blurred.clear();
    this.submitted = false;
    this.formError = '';
    this.result = null;
    this.fields.forEach((f) => (this.errors[f.id] = this.check(f)));
    this.toast.info('Filled in with your last assessment. Update anything that has changed.');
  }

  resetData() {
    this.state.clear();
    this.values = this.state.values;
    Object.keys(this.blocked).forEach((id) => this.clearBlocked(id));
    this.blurred.clear();
    this.submitted = false;
    this.formError = '';
    this.result = null;
    this.fields.forEach((f) => (this.errors[f.id] = this.check(f)));
  }
}
