import Chart from 'chart.js/auto';
import type { Plugin, TooltipItem } from 'chart.js';
import { RiskLevel, riskLevel } from '../../services/clinical';

// consistent look for every chart in the app
Chart.defaults.font.family = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = '#475569';
Chart.defaults.borderColor = '#e2e8f0';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.padding = 16;
Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.titleFont = { weight: 'bold' };

/** Shared colour palette. */
export const COLORS = {
  blue: '#2563eb',
  pink: '#ec4899',
  violet: '#8b5cf6',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  green: '#22c55e',
  indigo: '#6366f1'
};

/** Draws the exact number on every bar / slice so the figures can be read without hovering. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const valueLabels: Plugin<any> = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const type = (chart.config as { type: string }).type;
    chart.data.datasets.forEach((dataset, i) => {
      chart.getDatasetMeta(i).data.forEach((element, index) => {
        const value = Number(dataset.data[index]);
        if (!Number.isFinite(value) || (type !== 'bar' && value === 0)) return;
        const { x, y } = element.tooltipPosition(true) as { x: number; y: number };
        ctx.save();
        ctx.font = "700 14px 'Inter', system-ui, sans-serif";
        ctx.textAlign = 'center';
        if (type === 'bar') {
          ctx.fillStyle = '#0f172a';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(value), x, y - 5);
        } else {
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = 'rgba(15,23,42,0.5)';
          ctx.lineWidth = 3;
          ctx.textBaseline = 'middle';
          ctx.strokeText(String(value), x, y);
          ctx.fillText(String(value), x, y);
        }
        ctx.restore();
      });
    });
  }
};

/** Tooltip text "label: value (share %)". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tooltipWithPercent(item: TooltipItem<any>): string {
  const raw = item.parsed as number | { y: number };
  const value = typeof raw === 'number' ? raw : raw.y;
  const total = (item.dataset.data as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
  const share = total ? ` (${((value / total) * 100).toFixed(1)}%)` : '';
  return `${item.label}: ${value}${share}`;
}

export function percent(part: number, total: number): string {
  return total ? `${((part / total) * 100).toFixed(1)}%` : '–';
}

const LEVEL_COLOR: Record<RiskLevel, string> = { low: COLORS.green, moderate: COLORS.amber, high: COLORS.red };

/** Line chart of a patient's risk over time; every point is coloured by its risk band. */
export function drawTrend(canvas: string | HTMLCanvasElement, items: { createdAt: string; riskPercent: number }[]): Chart {
  // oldest first
  const ordered = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const labels = ordered.map((i) =>
    new Date(i.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }));
  const colors = ordered.map((i) => LEVEL_COLOR[riskLevel(i.riskPercent)]);

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: ordered.map((i) => i.riskPercent),
        borderColor: COLORS.blue,
        backgroundColor: 'rgba(37, 99, 235, 0.10)',
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: colors,
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => `Risk: ${item.parsed.y}%` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } }
      }
    }
  });
}
