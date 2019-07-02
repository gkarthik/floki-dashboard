import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import * as _ from "lodash";
import * as d3 from 'd3';

import * as tf from '@tensorflow/tfjs';

import { Taxon } from './taxon';

@Injectable({
  providedIn: 'root'
})
export class RegressionService {
  private reportUrl = "./assets/json-reports/test.json";
  private jsonData: Taxon = new Taxon();
  private selectedSample: string;
  private selectedTaxon: string;
  private currentPoints: [{
    "control": number,
    "sample": number,
    "name": string,
    "node_pos": number,
    "pathogenic": number
  }];
  private predictedPoints: number[];
  private pointCounts: number[];
  // Sample data elements
  // 0 - control reads
  // 1 - sample reads
  // 2 - name
  // 3 - node counts
  // 4-  pathogenic
  private sampleData: {
    "control": number[],
    "sample": number[],
    "name": string[],
    "node_pos": number[],
    "pathogenic": number[]
  };
  private logcontrolreads = null;
  private logtaxonreads = null;

  constructor(
    private http: HttpClient
  ) { }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      console.log(`${operation} failed: ${error.message}`);
      return of(result as T);
    };
  }

  getCurrentPoints(): [{
    "control": number,
    "sample": number,
    "name": string,
    "node_pos": number,
    "pathogenic": number
  }] {
    return this.currentPoints;
  }

  getTree(): Observable<any> {
    return this.http.get<any>(this.reportUrl)
      .pipe(
        tap(d => this.jsonData = d),
        catchError(this.handleError('getTree', []))
      );
  }

  cutScores(d: Taxon, threshold: number, selectedSample: string) {
    let num = d.file.indexOf(selectedSample)
    this.cutScoreNode(d, threshold, num);
    return d;
  }

  cutScoreNode(d: Taxon, threshold: number, j: number) {
    let ctrlscorearray = null;
    ctrlscorearray = d.ctrl_forward_score_distribution.split(",");
    for (let k = 0; k < 10; k++) {
      if (((k / 10) + 0.1) < threshold) {
        if (d.ctrl_reads - ctrlscorearray[k] <= 0 || isNaN(d.ctrl_reads - ctrlscorearray[k])) {
          d.ctrl_reads = 0;
        } else {
          d.ctrl_reads = d.ctrl_reads - ctrlscorearray[k]
        }
      }
    }
    let scorearray = null;
    scorearray = d.forward_score_distribution[j].split(",");
    for (let k = 0; k < 10; k++) {
      if (((k / 10) + 0.1) < threshold) {
        if (d.reads[j] - scorearray[k] < 0) {
          d.reads[j] = 0;
        } else {
          d.reads[j] = d.reads[j] - scorearray[k];
        }
      }
    }

    for (let i = 0; i < d.children.length; i++) {
      this.cutScoreNode(d.children[i], threshold, j);
    }
  }

  findTaxons(d: Taxon) {
    this.sampleData = {
      "control": [],
      "sample": [],
      "name": [],
      "node_pos": [],
      "pathogenic": []
    };
    this.searchTree(d);
  }

  searchTree(d: Taxon): void {
    let index = d.file.indexOf(this.selectedSample);
    if (d.rank == this.selectedTaxon) {
      if (d.reads[index] > 0 && d.taxon_name != "Homo sapiens") {
        if (d.ctrl_reads <= 0) {
          this.sampleData["control"].push(0.1);
        } else {
          this.sampleData["control"].push(d.ctrl_reads + Math.random() * 0.15);
        }
        if (d.reads[index] <= 0) {
          this.sampleData["sample"].push(0.1);
        } else {
          this.sampleData["sample"].push(d.reads[index] + Math.random() * 0.15);
        }
        this.sampleData["name"].push(d.taxon_name);
        this.sampleData["pathogenic"].push(d.pathogenic);
      }
    }
    for (let i = 0; i < d.children.length; i++) {
      this.searchTree(d.children[i]);
    }
  }

  arrangePoints() {
    this.currentPoints = [];
    this.logcontrolreads = [];
    this.logtaxonreads = [];
    for (let j = 0; j < this.sampleData.control.length; j++) {
      this.logcontrolreads.push(Math.log10(this.sampleData.sample[j]));
      this.logtaxonreads.push(Math.log10(this.sampleData.control[j]));
      this.currentPoints.push({
        "control": Math.log10(this.sampleData.control[j]),
        "sample": Math.log10(this.sampleData.sample[j]),
        "node_pos": 0,
        "name": this.sampleData.name[j],
        "pathogenic": this.sampleData.pathogenic[j]
      });
    };
  }

  async train(d: Taxon) {

    // this.linearModel = tf.sequential();
    // this.linearModel.add(tf.layers.dense({ units: 1, inputShape: [1] }));
    // this.linearModel.add(tf.layers.dense({ units: 1 }));
    // this.linearModel.compile({ loss: 'meanSquaredError', optimizer: 'adam' });

    const xs = tf.data.generator(this.logcontrolreads);
    const ys = tf.data.generator(this.logtaxonreads);
    const ds = tf.data.zip({ xs, ys }).shuffle(100).batch(32);

    const learningRate = 0.01;
    const optimizer = tf.train.sgd(learningRate);

    const m = tf.scalar(Math.random()).variable();
    const c = tf.scalar(Math.random()).variable();

    const numSteps = 100;

    // y = mx+c
    const model = x => m.mul(x).add(c);
    const loss = (pred, label) => pred.sub(label).square().mean();

    for (let epoch = 0; epoch < 5; epoch++) {
      await ds.forEachAsync(({ xs, ys }) => {
        optimizer.minimize(() => loss(model(xs), ys));
      });
      console.log('Epoch', epoch);
    }

    // await this.linearModel.fit(xs, ys, { "batchSize": 32, "epochs": 120 });

    const preds = [];
    const predictedPointsD = []
    this.predictedPoints = []
    for (let j = 1; j < d3.max(this.sampleData[this.selectedSample][0]); j += (d3.max(this.sampleData[this.selectedSample][0]) / 10)) {
      let output = model(Math.log10(j));
      let prediction = Array.from(output.dataSync())[0]
      preds.push(prediction);
      predictedPointsD.push({ x: Math.log10(j), y: prediction });
      this.predictedPoints.push({ x: Math.log10(j), y: prediction })
    }

    let comparingPoints = [];
    for (let j = 0; j < this.sampleData[this.selectedSample][0].length; j++) {
      let output = model.predict(tf.tensor2d([current[j][0]], [1, 1])) as any;
      let prediction = Array.from(output.dataSync())[0]
      if (isNaN(prediction)) {
        comparingPoints.push(0);
      } else {
        comparingPoints.push(prediction);
      }
    }

    this.pointCounts = [0, 0, 0]
    for (let j = 0; j < this.sampleData[this.selectedSample][0].length; j++) {
      if (current[j][1] > comparingPoints[j]) {
        current[j][3] = 2;
        this.pointCounts[2] += 1
      } else if (Math.round(Math.pow(10, current[j][1])) == Math.round(Math.pow(10, comparingPoints[j]))) {
        current[j][3] = 1;
        this.pointCounts[1] += 1
      } else {
        this.pointCounts[0] += 1
      }
    }
    document.getElementById("h1").innerHTML = '&nbsp';

    // return [this.predictedPoints, this.pointCounts];
    return [current, this.predictedPoints, this.pointCounts];
  }

  // learningModel(d: Taxon, sample: string, taxon: string) {
  //   document.getElementById("h1").innerHTML = "Analyzing . . .";
  //   this.selectedSample = sample;
  //   this.selectedTaxon = taxon;
  //   let data = _.cloneDeep(this.jsonData);
  //   this.sampleData = {};
  //   this.findTaxons(data, this.sampleData);
  //   this.arrangePoints(data, this.sampleData);
  //   this.train(data, this.sampleData);
  // }

  prepareAnalysis(sample: string, taxon: string): [{
    "control": number,
    "sample": number,
    "node_pos": number,
    "name": string,
    "pathogenic": number
  }] {
    document.getElementById("h1").innerHTML = "Analyzing . . .";
    this.selectedSample = sample;
    this.selectedTaxon = taxon;
    let data = _.cloneDeep(this.jsonData);
    this.findTaxons(data);
    this.arrangePoints();
    return this.currentPoints;
  }

  // runPrediction(d: Taxon, sample: string, taxon: string){
  //   let data = _.cloneDeep(this.jsonData);
  //   this.train(data, this.sampleData);
  // }

}
