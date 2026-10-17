import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import Chart from 'chart.js/auto';
import { ApiService, Assessment, errorMessage } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Advice, RISK_LABEL, adviceFor, riskLevel } from '../../services/clinical';
import { ToastService } from '../../services/toast.service';
import { drawTrend } from './chart-helpers';

/** Patient home: an overview of their own assessments. */
@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  rows: Assessment[] = []; // newest first
  loaded = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chart: Chart<any> | null = null;

  constructor(private api: ApiService, private auth: AuthService, private toast: ToastService) {}

  /** the trend <canvas> only exists once there are assessments, so the chart is drawn when it appears */
  private trendRef: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild('trend') set trendCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.trendRef = ref;
    this.draw();
  }

  get firstName(): string {
    return this.auth.name.split(' ')[0] || 'there';
  }

  get latest(): Assessment | null {
    return this.rows[0] ?? null;
  }

  get previous(): Assessment | null {
    return this.rows[1] ?? null;
  }

  get average(): number {
    return this.rows.length ? this.rows.reduce((sum, r) => sum + r.riskPercent, 0) / this.rows.length : 0;
  }

  /** change in percentage points compared with the assessment before the latest */
  get change(): number | null {
    return this.latest && this.previous ? this.latest.riskPercent - this.previous.riskPercent : null;
  }

  get verdict(): string {
    return this.latest?.prediction === 1 ? 'Prone to heart attack' : 'Not prone to heart attack';
  }

  get levelLabel(): string {
    return this.latest ? RISK_LABEL[riskLevel(this.latest.riskPercent)] : '';
  }

  /** suggestions for the latest result - computed once per load (a getter would create a new array on every change-detection pass) */
  advice: Advice[] = [];

  /** "Today", "Yesterday", "5 days ago" */
  get lastCheck(): string {
    if (!this.latest) return '';
    const days = Math.floor((Date.now() - new Date(this.latest.createdAt).getTime()) / 86_400_000);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
  }

  trackIndex = (index: number) => index;

  ngOnInit() {
    this.api.assessments().subscribe({
      next: (r) => {
        this.rows = r.rows;
        this.advice = this.latest ? adviceFor(this.latest.inputs, riskLevel(this.latest.riskPercent)).slice(0, 4) : [];
        this.loaded = true;
        this.draw(); // refresh the chart if the canvas is already on screen
      },
      error: (e) => {
        this.loaded = true;
        this.toast.error(errorMessage(e, 'Could not load your assessments.'));
      }
    });
  }

  private draw() {
    this.chart?.destroy();
    this.chart = this.rows.length && this.trendRef ? drawTrend(this.trendRef.nativeElement, this.rows) : null;
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
