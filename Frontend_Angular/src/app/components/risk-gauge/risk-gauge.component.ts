import { Component, Input } from '@angular/core';
import { RISK_LABEL, RiskLevel, riskLevel } from '../../services/clinical';

/** Semicircular gauge showing a risk percentage, coloured by risk band. */
@Component({
  standalone: false,
  selector: 'app-risk-gauge',
  templateUrl: './risk-gauge.component.html',
  styleUrls: ['./risk-gauge.component.css']
})
export class RiskGaugeComponent {
  @Input() percent = 0;

  get level(): RiskLevel {
    return riskLevel(this.percent);
  }

  get label(): string {
    return RISK_LABEL[this.level];
  }
}
