import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import * as _ from "lodash";

import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';

import { Taxon } from './taxon';

@Injectable({
  providedIn: 'root'
})
export class RegressionService {
  private reportUrl = "./assets/json-reports/test.json";
  private jsonData: Taxon = new Taxon();

  constructor(
    private http: HttpClient
  ) { }

  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      console.log(`${operation} failed: ${error.message}`);
      return of(result as T);
    };
  }

  getTree(): Observable<any> {
    return this.http.get<any>(this.reportUrl)
      .pipe(
      	tap(d => this.jsonData = d),
      	catchError(this.handleError('getTree', []))
      );
  }

  findTaxons(d: Taxon, x = {}){
    for (let i = 0; i< d.file.length; i++) {
      x[d.file[i]]=[]
      x[d.file[i]][0]=[]
      x[d.file[i]][1]=[]
    }
    this.searchthetree(d,x);
  }

  searchthetree(d: Taxon, x: {}): void{
    if(d.rank=='species'){
      for (let i = 0; i< d.file.length; i++) {
        if(d.taxon_reads[i]>0){
          if(d.ctrl_reads==0){
            x[d.file[i]][0].push(0);
          }else{
            x[d.file[i]][0].push(d.ctrl_reads);
          }
          x[d.file[i]][1].push(d.taxon_reads[i]);
        }
      }

    }
    for (let i = 0; i < d.children.length; i++) {
      this.searchthetree(d.children[i], x);
    }
  }

  graphPoints(d: Taxon, x: {}) {
    let i = 2;

    let values = []
    for (let j = 0; j< x[d.file[i]][0].length; j++) {
      values.push({x: x[d.file[i]][0][j], y: x[d.file[i]][1][j]});
    };

    tfvis.render.scatterplot(
      {name: 'Reads by Control Reads'},
      {values},
      {
        xLabel: 'Control Reads',
        yLabel: 'Taxon Reads',
        height: 300
      }
    );
  }

  async train(d: Taxon, x: {}) {
    let i = 2;

    let values = []
    for (let j = 0; j< x[d.file[i]][0].length; j++) {
      values.push({x: x[d.file[i]][0][j], y: x[d.file[i]][1][j]});
    };
    const learningRate = 0.0001;
    const optimizer = tf.train.sgd(learningRate);

    this.linearModel = tf.sequential();
    this.linearModel.add(tf.layers.dense({units: 1, inputShape: [1]}));
    this.linearModel.compile({loss: 'meanSquaredError', optimizer: 'sgd'});

    const xs = tf.tensor1d(x[d.file[i]][0]);

    const ys = tf.tensor1d(x[d.file[i]][1]);

    // console.log(xs);

    // const xs = tf.tensor1d([1, 2, 3]);
    // // console.log(xs);
    // const ys = tf.tensor1d([1, 2, 3]);

    await this.linearModel.fit(xs, ys)

    const xsp = tf.linspace(0, 100000, 1000);

    const preds = []

    for (let j = 1; j<100000; j+=100) {
      let output = this.linearModel.predict(tf.tensor2d([j], [1, 1])) as any;
      this.prediction = Array.from(output.dataSync())[0]
      preds.push(this.prediction);
    }

    // const [xsp, preds]= tf.tidy(()=>{
    //   const xsp = tf.linspace(0, 100000, 1000);
    //   const preds = this.linearModel.predict(xsp.reshape([1000, 1]));
    //   return [xsp.dataSync(), preds.dataSync()];
    // });
    //
    console.log(preds)

    const predictedPoints = Array.from(xsp).map((val, k) => {
      return {x: val, y: preds[k]};
    });

    tfvis.render.scatterplot(
      {name: 'Model Predictions vs Original Data'},
      {values: [values, predictedPoints], series: ['current', 'predicted']},
      {
        xLabel: 'Mark',
        yLabel: 'Shortness',
        height: 300
      }
    );
  }

  predict(val: number) {
    const output = this.linearModel.predict(tf.tensor2d([val], [1, 1])) as any;
    this.prediction = Array.from(output.dataSync())[0]
  }

  // modelPredict (model: tf.Optimizer, currentvalues:[]) {
  //   // console.log('model trainified!')
  //   let xs = tf.linspace(0, 1, 100);
  //   let preds = this.linearModel.predict(xs.reshape([100, 1]));
  //
  //   const predictedPoints = Array.from(xs).map((val, j) => {
  //     return {x: val, y: preds[j]};
  //   });
  //   console.log(predictedPoints);
  //
  //   tfvis.render.scatterplot(
  //     {name: 'Model Predictions vs Original Data'},
  //     {values: [currentvalues, predictedPoints], series: ['current', 'predicted']},
  //     {
  //       xLabel: 'Mark',
  //       yLabel: 'Shortness',
  //       height: 300
  //     }
  //   );
  // }

  // predict(val: number) {
  //    const output = this.linearModel.predict(
  // }

  learningModel(d: Taxon) {
    let data = _.cloneDeep(this.jsonData);
    let x={};
    this.findTaxons(data, x);
    this.graphPoints(data, x);
    this.train(data, x);
  }

}
