import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TaxonomyViewComponent } from './taxonomy-view/taxonomy-view.component';
import { NodeBarChartComponent } from './node-bar-chart/node-bar-chart.component';
import { NodePathogenicTableComponent } from './node-pathogenic-table/node-pathogenic-table.component';
import { AnnotationComponent } from './annotation/annotation.component';
import { ScoreDistributionChartComponent } from './score-distribution-chart/score-distribution-chart.component';
import { ContaminantComponent } from './contaminant/contaminant.component';

@NgModule({
  declarations: [
    AppComponent,
    TaxonomyViewComponent,
    NodeBarChartComponent,
    NodePathogenicTableComponent,
    AnnotationComponent,
    ScoreDistributionChartComponent,
    ContaminantComponent
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
