import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import Chart from 'chart.js/auto';
import type { ChartOptions } from 'chart.js';
import { AdminDashboardStats, ApiService, errorMessage } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { COLORS, percent, tooltipWithPercent, valueLabels } from '../dashboard/chart-helpers';

interface Tile {
  label: string;
  value: number;
  share?: string;
  icon: string;
  tone: string;
}

/** Admin overview: who uses the app, how it is used and how healthy the prediction model is. */
@Component({
  standalone: false,
  selector: 'app-admindashboard',
  templateUrl: './admindashboard.component.html',
  styleUrls: ['./admindashboard.component.css']
})
export class AdmindashboardComponent implements AfterViewInit, OnDestroy {
  stats: AdminDashboardStats | null = null;
  tiles: Tile[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private charts: Chart<any>[] = [];

  constructor(private api: ApiService, private toast: ToastService) {}

  ngAfterViewInit() {
    this.load();
  }

  /** Reads the latest figures from the database and redraws the charts. */
  load() {
    this.api.adminDashboard().subscribe({
      next: (s) => {
        this.stats = s;
        const a = s.assessments;
        this.tiles = [
          { label: 'Registered patients', value: s.total, icon: 'bi-people-fill', tone: 'tone-blue' },
          { label: 'Assessments run', value: a.total, icon: 'bi-clipboard2-pulse-fill', tone: 'tone-teal' },
          { label: 'High-risk results', value: a.levels.high, share: percent(a.levels.high, a.total), icon: 'bi-exclamation-triangle-fill', tone: 'tone-red' },
          { label: 'Training records', value: s.dataset.records, icon: 'bi-database-fill', tone: 'tone-violet' }
        ];
        this.draw(s);
      },
      error: (e) => this.toast.error(errorMessage(e, 'Could not load the overview.'))
    });
  }

  private draw(s: AdminDashboardStats) {
    this.destroyCharts();
    const donut: ChartOptions<'doughnut'> = {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: tooltipWithPercent } } }
    };
    const bars: ChartOptions<'bar'> = {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grace: '14%', ticks: { precision: 0 } } }
    };
    const slice = { borderWidth: 3, borderColor: '#fff', hoverOffset: 8 };

    const g = s.genders;
    const lv = s.assessments.levels;
    const day = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

    this.charts = [
      new Chart('chart1', {
        type: 'bar',
        data: {
          labels: s.assessments.daily.map((d) => day(d.date)),
          datasets: [{ data: s.assessments.daily.map((d) => d.count), backgroundColor: COLORS.blue, borderRadius: 6, maxBarThickness: 36 }]
        },
        options: bars,
        plugins: [valueLabels]
      }),
      new Chart('chart2', {
        type: 'doughnut',
        data: {
          labels: ['Low risk', 'Moderate risk', 'High risk'],
          datasets: [{ data: [lv.low, lv.moderate, lv.high], backgroundColor: [COLORS.green, COLORS.amber, COLORS.red], ...slice }]
        },
        options: donut,
        plugins: [valueLabels]
      }),
      new Chart('chart3', {
        type: 'doughnut',
        data: {
          labels: ['Female', 'Male', 'Others'],
          datasets: [{ data: [g['Female'] ?? 0, g['Male'] ?? 0, g['Others'] ?? 0], backgroundColor: [COLORS.pink, COLORS.blue, COLORS.violet], ...slice }]
        },
        options: donut,
        plugins: [valueLabels]
      }),
      new Chart('chart4', {
        type: 'doughnut',
        data: {
          labels: ['Prone to heart attack', 'Not prone'],
          datasets: [{ data: [s.dataset.prone, s.dataset.notProne], backgroundColor: [COLORS.red, COLORS.green], ...slice }]
        },
        options: donut,
        plugins: [valueLabels]
      })
    ];
  }

  private destroyCharts() {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  ngOnDestroy() {
    this.destroyCharts();
  }
}
