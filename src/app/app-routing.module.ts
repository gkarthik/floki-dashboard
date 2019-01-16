import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TaxonomyViewComponent } from './taxonomy-view/taxonomy-view.component';
import { AnnotationComponent } from './annotation/annotation.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'taxonomy' },
  { path: 'taxonomy', component: TaxonomyViewComponent },
  { path: 'antibiotic-resistance', component: AnnotationComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
