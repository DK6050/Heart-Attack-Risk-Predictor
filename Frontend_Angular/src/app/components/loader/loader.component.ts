import { Component } from '@angular/core';
import { LoaderService } from '../../services/loader.service';

/** Full-screen loading overlay driven by LoaderService (one instance, in app.component.html). */
@Component({
  standalone: false,
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.css']
})
export class LoaderComponent {
  constructor(public loader: LoaderService) {}
}
