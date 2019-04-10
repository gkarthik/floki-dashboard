import { Component } from '@angular/core';
import { TaxonomyViewComponent } from './taxonomy-view/taxonomy-view.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: [
    './app.component.css',
    '../../node_modules/lato-font/css/lato-font.min.css'
  ]
})
export class AppComponent {
  title = 'Floki';
}
