import { Component, OnInit, AfterViewInit } from '@angular/core';

import { Taxon } from '../taxon';

import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';

import { RegressionService } from '../regression.service';
//
// import * as tf from '@tensorflow/tfjs';
// import * as tfvis from '@tensorflow/tfjs-vis';

@Component({
  selector: 'app-regression',
  templateUrl: './regression.component.html',
  styleUrls: ['./regression.component.css']
})
export class RegressionComponent implements AfterViewInit, OnInit  {

  constructor(
      private regressionService: RegressionService
  ) { }

  private jsonData: Taxon = new Taxon();
  private linearModel: tf.Sequential = null;
  private filterednodes: Taxon = new Taxon();

  private selectedSample: string;
  private selectedTaxon: string;

  ngOnInit() {
    this.regressionService.getTree().subscribe(_ => this.onInit(_));
  }

  onInit(_: Taxon): void {
    this.jsonData = _;

  }

  ngAfterViewInit(){

  }

  realize(){
    this.regressionService.learningModel(this.jsonData, this.selectedSample, this.selectedTaxon);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!_.isEmpty(this.nodeData)) {
      this.selectedSample = (this.jsonData["file"].length > 0) ? this.jsonData["file"][0] : "";
    }
  }

  // async train() {
  //     // Define a model for linear regression.
  //   this.linearModel = tf.sequential();
  //   this.linearModel.add(tf.layers.dense({units: 1, inputShape: [1]}));
  //
  //   // Prepare the model for training: Specify the loss and the optimizer.
  //   this.linearModel.compile({loss: 'meanSquaredError', optimizer: 'sgd'});
  //
  //
  //   // Training data, completely random stuff
  //   const xs = tf.tensor1d([3.2, 4.4, 5.5]);
  //   const ys = tf.tensor1d([1.6, 2.7, 3.5]);
  //
  //
  //   // Train
  //   await this.linearModel.fit(xs, ys)
  //
  //   console.log('model trained!')
  // }

  // predict(val) {
  // // todo
  // }

}
