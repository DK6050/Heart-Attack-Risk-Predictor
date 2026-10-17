import { Component } from '@angular/core';
import { PredictStateService } from './services/predict-state.service';

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'myapp';

  // created eagerly so the saved Predict form is always cleared when the user logs out
  constructor(_predictState: PredictStateService) {}
}
