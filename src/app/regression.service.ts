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
    this.currentPoints = Array() as [{
      "control": number,
      "sample": number,
      "name": string,
      "node_pos": number,
      "pathogenic": number
    }];
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

  async trainAndPredict(d: Taxon) {

    // this.linearModel = tf.sequential();
    // this.linearModel.add(tf.layers.dense({ units: 1, inputShape: [1] }));
    // this.linearModel.add(tf.layers.dense({ units: 1 }));
    // this.linearModel.compile({ loss: 'meanSquaredError', optimizer: 'adam' });

    const xs = tf.data.array(this.logcontrolreads);
    const ys = tf.data.array(this.logtaxonreads);
    const ds = tf.data.zip({ x: xs, y: ys }).shuffle(100).batch(32);
    const learningRate = 0.01;
    const optimizer = tf.train.sgd(learningRate);
    // Init slope and intercept
    const m = tf.scalar(Math.random()).variable();
    const c = tf.scalar(Math.random()).variable();
    // y = mx+c
    const model = x => m.mul(x).add(c);
    const loss = (pred, label) => pred.sub(label).square().mean();

    for (let epoch = 0; epoch < 100; epoch++) {
      await ds.forEachAsync(({ x, y }) => {
        optimizer.minimize(() => {
          const predYs = model(x);
          const l = loss(y, predYs);
          // l.data().then(_ => console.log('Loss', _));
          return l;
        });
      });
    }
    let test_x: number[] = [];
    for (let i = Math.min.apply(null, this.logcontrolreads); i < Math.max.apply(null, this.logcontrolreads); i++) {
      test_x.push(0.5 * i);
    }
    let pred_y = model(tf.tensor(test_x)).dataSync();
    let predictions: number[][] = [];
    await pred_y.forEach((pred, i) => {
      predictions.push([test_x[i], pred]);
    });
    return predictions;
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
    this.selectedSample = sample;
    this.selectedTaxon = taxon;
    let data = _.cloneDeep(this.jsonData);
    this.findTaxons(data);
    this.arrangePoints();
    return this.currentPoints;
  }
}
