import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import Chart from 'chart.js/auto';
import { ApiService, Assessment, errorMessage } from '../../services/api.service';
import { Advice, FEATURE_NAMES, RISK_LABEL, RiskLevel, adviceFor, formatInput, riskLevel } from '../../services/clinical';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';
import { drawTrend } from '../dashboard/chart-helpers';

const FEATURES = ['age', 'sex', 'cp', 'trtbps', 'chol', 'fbs', 'restecg', 'thalachh', 'exng', 'oldpeak', 'slp', 'caa', 'thall'];

/** A patient's own past assessments: trend, details report, export and deletion. */
@Component({
  standalone: false,
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit, OnDestroy {
  rows: Assessment[] = []; // newest first
  loaded = false;
  selected: Assessment | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chart: Chart<any> | null = null;

  constructor(private api: ApiService, private confirm: ConfirmService, private toast: ToastService) {}

  /** the trend <canvas> only exists once there are assessments, so the chart is drawn when it appears */
  private trendRef: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild('trend') set trendCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.trendRef = ref;
    this.draw();
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.assessments().subscribe({
      next: (r) => {
        this.rows = r.rows;
        this.loaded = true;
        this.draw(); // refresh the chart if the canvas is already on screen
      },
      error: (e) => {
        this.loaded = true;
        this.toast.error(errorMessage(e, 'Could not load your history.'));
      }
    });
  }

  private draw() {
    this.chart?.destroy();
    this.chart = this.rows.length && this.trendRef ? drawTrend(this.trendRef.nativeElement, this.rows) : null;
  }

  /** list items are identified by position, so the report lists are not rebuilt on every change-detection pass */
  trackIndex = (index: number) => index;

  // ---------- presentation helpers
  level(r: Assessment): RiskLevel {
    return riskLevel(r.riskPercent);
  }

  levelLabel(r: Assessment): string {
    return RISK_LABEL[this.level(r)];
  }

  badgeClass(r: Assessment): string {
    return { low: 'badge-success', moderate: 'badge-warning', high: 'badge-danger' }[this.level(r)];
  }

  inputRows(r: Assessment): { label: string; value: string }[] {
    return FEATURES.map((f) => ({ label: FEATURE_NAMES[f], value: formatInput(f, r.inputs[f]) }));
  }

  factorRows(r: Assessment): { label: string; value: string; raises: boolean; width: number }[] {
    const max = Math.max(...r.factors.map((f) => Math.abs(f.impact)), 0.0001);
    return r.factors.slice(0, 5).map((f) => ({
      label: FEATURE_NAMES[f.feature] ?? f.feature,
      value: formatInput(f.feature, r.inputs[f.feature]),
      raises: f.impact > 0,
      width: Math.max(8, Math.round((Math.abs(f.impact) / max) * 100))
    }));
  }

  advice(r: Assessment): Advice[] {
    return adviceFor(r.inputs, this.level(r));
  }

  // ---------- actions
  open(r: Assessment) {
    this.selected = r;
  }

  @HostListener('document:keydown.escape')
  close() {
    this.selected = null;
  }

  async remove(r: Assessment) {
    const ok = await this.confirm.ask({
      title: 'Delete this assessment?',
      message: `The assessment from ${new Date(r.createdAt).toLocaleString()} will be permanently removed from your history.`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteAssessment(r.id).subscribe({
      next: () => {
        this.toast.success('Assessment deleted.');
        if (this.selected?.id === r.id) this.selected = null;
        this.load();
      },
      error: (e) => this.toast.error(errorMessage(e, 'Could not delete the assessment.'))
    });
  }

  /** download the whole history as a CSV file */
  exportCsv() {
    const header = ['date', 'risk_percent', 'result', ...FEATURES];
    const lines = this.rows.map((r) => [
      r.createdAt,
      r.riskPercent,
      r.prediction === 1 ? 'prone' : 'not prone',
      ...FEATURES.map((f) => r.inputs[f])
    ].join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-heart-assessments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('Your history was downloaded.');
  }

  /** print (or save as PDF) just the open report */
  printReport() {
    document.body.classList.add('print-report');
    window.addEventListener('afterprint', () => document.body.classList.remove('print-report'), { once: true });
    window.print();
  }

  ngOnDestroy() {
    this.chart?.destroy();
    document.body.classList.remove('print-report');
  }
}
