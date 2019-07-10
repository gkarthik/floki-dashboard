import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TaxonomyViewComponent } from './taxonomy-view/taxonomy-view.component';
import { AnnotationComponent } from './annotation/annotation.component';
import { ContaminantComponent } from './contaminant/contaminant.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'taxonomy' },
  { path: 'taxonomy', component: TaxonomyViewComponent },
  { path: 'antibiotic-resistance', component: AnnotationComponent },
  { path: 'contaminant', component: ContaminantComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
