import { Component, OnInit } from '@angular/core';

import { AntibioticResistance } from '../antibiotic-resistance';

import { AnnotationService } from '../annotation.service';

@Component({
  selector: 'app-annotation',
  templateUrl: './annotation.component.html',
  styleUrls: ['./annotation.component.css']
})
export class AnnotationComponent implements OnInit {

  constructor(
    private annotationService: AnnotationService
  ) { }

  private arData: AntibioticResistance[];

  ngOnInit() {
    this.annotationService.getJson().subscribe(_ => this.arData = _);
  }

}
