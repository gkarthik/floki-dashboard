import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TaxonomyViewComponent } from './taxonomy-view/taxonomy-view.component';
import { NodeBarChartComponent } from './node-bar-chart/node-bar-chart.component';

@NgModule({
  declarations: [
    AppComponent,
    TaxonomyViewComponent,
    NodeBarChartComponent
  ],
  imports: [
    HttpClientModule,
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
