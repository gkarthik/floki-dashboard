import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TaxonomyViewComponent } from './taxonomy-view/taxonomy-view.component';
import { NodeBarChartComponent } from './node-bar-chart/node-bar-chart.component';
import { AnnotationComponent } from './annotation/annotation.component';
import { ScoreDistributionChartComponent } from './score-distribution-chart/score-distribution-chart.component';

@NgModule({
  declarations: [
    AppComponent,
    TaxonomyViewComponent,
    NodeBarChartComponent,
    AnnotationComponent,
    ScoreDistributionChartComponent
  ],
  imports: [
    HttpClientModule,
    BrowserModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
