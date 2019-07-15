import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import * as _ from "lodash";

import * as tf from '@tensorflow/tfjs';
import TSNE from 'tsne-js';

import { Taxon } from './taxon';

@Injectable({
  providedIn: 'root'
})
export class ContaminantService {
  private reportUrl = "./assets/json-reports/test.json";
  private jsonData: Taxon = new Taxon();
  private selectedSample: string;
  private selectedTaxon: string;
  private rootReads: number[][];
  private currentPoints: [{	// List of dict for d3 data()
    "control": number,
    "sample": number,
    "name": string,
    "node_pos": number,
    "pathogenic": number,
    "tax_id": number
  }];
  private totalPoints: [{
    "control": number,
    "sample": number[],
    "percentage": number[],
    "name": string,
    "pathogenic": number,
    "tax_id": number
  }];
  private plotTotalPoints: [{
    "control": number,
    "sample": number[],
    "percentage": number[],
    "name": string,
    "pathogenic": number,
    "tsneX":number,
    "tsneY":number,
    "node_pos":number,
    "tax_id": number
  }];
  private SamplePoints: [{
    "control": number[],
    "sample": number[],
    "percentage": number[][],
    "name": string[],
    "pathogenic": number[],
    "tsneX":number,
    "tsneY":number,
    "tax_id": number[][]
  }];
  private plotSamplePoints: [{
    // "control": number[],
    // "sample": number[],
    // "percentage": number[][],
    "name": string,
    // "pathogenic": number[],
    "tsneX":number,
    "tsneY":number,
    // "tax_id": number[][]
  }];
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
    "pathogenic": number[],
    "tax_id": number[]
  };
  private train: {
    "ctrl_reads_log": number[],
    "taxa_reads_log": number[]
  }
  private pointCounts: number[];

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
    "tax_id": number,
  }] {
    return this.currentPoints;
  }

  getPlotTotalPoints(): [{
    "control": number,
    "sample": number[],
    "percentage": number[],
    "name": string,
    "pathogenic": number
    "tsneX":number,
    "tsneY":number,
    "node_pos":number,
    "tax_id": number
  }] {
    return this.plotTotalPoints;
  }

    getPlotSamplePoints(): [{
      // "control": number[],
      // "sample": number[],
      // "percentage": number[][],
      "name": string,
      // "pathogenic": number[],
      "tsneX":number,
      "tsneY":number,
      // "tax_id": number[][]
    }] {
      return this.plotSamplePoints;
    }


  getPointCounts(): number[] {
    return this.pointCounts;
  }

  getTree(): Observable<any> {
    return this.http.get<any>(this.reportUrl)
      .pipe(
        tap(d => this.jsonData = d),
        catchError(this.handleError('getTree', []))
      );
  }
  cutScores(d: Taxon, threshold: number) {
    this.cutScoresNode(d, threshold);
    this.sumTaxReads(d);
    this.rootReads = [d.taxon_reads,[d.ctrl_taxon_reads]];
    return d;
  }


  cutScoresNode(d: Taxon, threshold: number) {
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
    for (let j = 0; j < d.file.length; j++) {
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
    }
    if (d.children) {
      for (let i = 0; i < d.children.length; i++) {
        this.cutScoresNode(d.children[i], threshold);
      }
    }
  }

  sumTaxReads(d: Taxon): number[][] {
    let childreads: number[] = Array(d.file.length).fill(0);
    let child_ctrlreads: number = 0;
    if (d.children) {
      // childreads = childreads + d.children.forEach(this.sumTaxReads);
      for (let i = 0; i < d.children.length; i++) {
        let tmp = this.sumTaxReads(d.children[i])
        childreads = tmp[0].map(function(num, idx) {
          return num + childreads[idx];
        })
        child_ctrlreads = child_ctrlreads + tmp[1][0];
      }
    }
    for (let j = 0; j < d.file.length; j++) {
      if (isNaN(d.reads[j])) {
        d.taxon_reads[j] = childreads[j] + 0
      } else {
        d.taxon_reads[j] = d.reads[j] + childreads[j]
      }
    }
    if (isNaN(d.ctrl_taxon_reads)) {
      d.ctrl_taxon_reads = 0 + child_ctrlreads;
    } else {
      d.ctrl_taxon_reads = d.ctrl_reads + child_ctrlreads;
    }
    return [d.taxon_reads, [d.ctrl_taxon_reads]];
  }
  // cutScores(d: Taxon, threshold: number, selectedSample: string) {
  //   let num = d.file.indexOf(selectedSample)
  //   this.cutScoreNode(d, threshold, num);
  //   this.sumTaxReads(d);
  //   return d;
  // }
  //
  // cutScoreNode(d: Taxon, threshold: number, j: number) {
  //   let ctrlscorearray = null;
  //   ctrlscorearray = d.ctrl_forward_score_distribution.split(",");
  //   for (let k = 0; k < 10; k++) {
  //     if (((k / 10) + 0.1) < threshold) {
  //       if (d.ctrl_reads - ctrlscorearray[k] <= 0 || isNaN(d.ctrl_reads - ctrlscorearray[k])) {
  //         d.ctrl_reads = 0;
  //       } else {
  //         d.ctrl_reads = d.ctrl_reads - ctrlscorearray[k];
  //       }
  //     }
  //   }
  //   let scorearray = null;
  //   scorearray = d.forward_score_distribution[j].split(",");
  //   for (let k = 0; k < 10; k++) {
  //     if (((k / 10) + 0.1) < threshold) {
  //       if (d.reads[j] - scorearray[k] < 0) {
  //         d.reads[j] = 0;
  //       } else {
  //         d.reads[j] = d.reads[j] - scorearray[k];
  //       }
  //     }
  //   }
  //   for (let i = 0; i < d.children.length; i++) {
  //     this.cutScoreNode(d.children[i], threshold, j);
  //   }
  // }
  //
  // sumTaxReads(d: Taxon): number[][] {
  //   let childreads: number[] = Array(d.file.length).fill(0);
  //   let child_ctrlreads: number = 0;
  //   if (d.children) {
  //     // childreads = childreads + d.children.forEach(this.sumTaxReads);
  //     for (let i = 0; i < d.children.length; i++) {
  //       let tmp = this.sumTaxReads(d.children[i])
  //       childreads = tmp[0].map(function(num, idx) {
  //         return num + childreads[idx];
  //       })
  //       child_ctrlreads = child_ctrlreads + tmp[1][0];
  //     }
  //   }
  //   for (let j = 0; j < d.file.length; j++) {
  //     if (isNaN(d.reads[j])) {
  //       d.taxon_reads[j] = childreads[j] + 0
  //     } else {
  //       d.taxon_reads[j] = d.reads[j] + childreads[j]
  //     }
  //   }
  //   if (isNaN(d.ctrl_taxon_reads)) {
  //     d.ctrl_taxon_reads = 0 + child_ctrlreads;
  //   } else {
  //     d.ctrl_taxon_reads = d.ctrl_reads + child_ctrlreads;
  //   }
  //   return [d.taxon_reads, [d.ctrl_taxon_reads]];
  // }

  findTaxons(d: Taxon) {
    this.sampleData = {
      "control": [],
      "sample": [],
      "name": [],
      "node_pos": [],
      "pathogenic": [],
      "tax_id": []
    };
    this.searchTree(d);
  }

  searchTree(d: Taxon): void {
    let index = d.file.indexOf(this.selectedSample);
    if (d.rank == this.selectedTaxon) {
      if (d.taxon_reads[index] > 0 && d.taxon_name != "Homo sapiens") {
        this.sampleData["control"].push(d.ctrl_reads);
        this.sampleData["sample"].push(d.taxon_reads[index]);
        this.sampleData["name"].push(d.taxon_name);
        this.sampleData["pathogenic"].push(d.pathogenic);
        this.sampleData["tax_id"].push(d.tax_id);
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
      "pathogenic": number,
      "tax_id": number
    }];
    this.train = {
      "ctrl_reads_log": _.cloneDeep(this.sampleData.control).map((x) => Math.log10(x + 1)),
      "taxa_reads_log": _.cloneDeep(this.sampleData.sample).map((x) => Math.log10(x + 1))
    }
    for (let j = 0; j < this.sampleData.control.length; j++) {
      this.currentPoints.push({
        "control": Math.log10(this.sampleData.control[j] + 1  + 0.15 * Math.random()),
        "sample": Math.log10(this.sampleData.sample[j] + 1  + 0.15 * Math.random()),
        "node_pos": 0,
        "name": this.sampleData.name[j],
        "pathogenic": this.sampleData.pathogenic[j],
        "tax_id": this.sampleData.tax_id[j]
      });
    };
    for (let j = 0; j < this.plotTotalPoints.length; j++) {
      this.plotTotalPoints[j].node_pos=3;
      for (let k = 0; k < this.currentPoints.length; k++) {
        if(this.currentPoints[k].tax_id == this.plotTotalPoints[j].tax_id) {
          this.plotTotalPoints[j].node_pos = 0;
        }
      }
    }
  }

  async trainAndPredict() {

    const xs = tf.data.array(this.train.ctrl_reads_log);
    const ys = tf.data.array(this.train.taxa_reads_log);
    const ds = tf.data.zip({ x: xs, y: ys }).shuffle(100).batch(32);
    const learningRate = 0.01;
    const optimizer = tf.train.sgd(learningRate);
    // Init slope and intercept
    const m = tf.scalar(Math.random()).variable();
    const c = tf.scalar(Math.random()).variable();
    // y = mx+c
    const model = x => m.mul(x).add(c);
    const loss = (pred, label) => pred.sub(label).square().mean();

    for(let epoch = 0; epoch<100;epoch++){
      await new Promise(resolve=> setTimeout(resolve, 1));
      await ds.forEachAsync(({x,y}) => {
        optimizer.minimize(() => {
          const predYs = model(x);
          const l = loss(y, predYs);
          //  l.data().then(_ => console.log('Loss', _));
          return l;
        });
      });
    }
    console.log("Finished");

    let test_x: number[] = [];
    let diff = Math.max.apply(null, this.train.ctrl_reads_log) - Math.min.apply(null, this.train.ctrl_reads_log);
    diff /= 10;
    for (let i = 0; i <= 10; i++) {
      test_x.push(i * diff + Math.min.apply(null, this.train.ctrl_reads_log));
    }
    let pred_y = model(tf.tensor(test_x)).dataSync();
    let predictions: number[][] = [];
    test_x.forEach((test, i) => {
      predictions.push([test, pred_y[i]]);
    });

    test_x=this.train.ctrl_reads_log;
    pred_y = model(tf.tensor(test_x)).dataSync();
    let comparingPoints:number[] = [];
    test_x.forEach((test, i) => {
      comparingPoints.push(pred_y[i]);
    });

    this.pointCounts = Array(3).fill(0);

    for(let j = 0; j < this.currentPoints.length; j++){
      if(Math.pow(10,this.currentPoints[j].sample) > Math.pow(10,comparingPoints[j])){
        this.currentPoints[j].node_pos=2;
        this.pointCounts[2]+=1
      }else if (Math.pow(10,this.currentPoints[j].sample) == Math.pow(10,comparingPoints[j])){
        this.currentPoints[j].node_pos=1;
        this.pointCounts[1]+=1
      }else{
        this.pointCounts[0]+=1
      }
      for(let k = 0; k < this.plotTotalPoints.length; k++){
        if(this.currentPoints[j].name==this.plotTotalPoints[k].name){
          this.plotTotalPoints[k].node_pos=this.currentPoints[j].node_pos;
        }
      }
    }

    return predictions;
  }

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

  findTotals(d: Taxon, rootReads: number[][], selectedsample: string) {
    this.totalPoints = {
      "control":[],
      "sample":[],
      "percentage":[],
      "name":[],
      "pathogenic":[],
      "tax_id": []
    }
    this.plotTotalPoints = Array() as [{
      "control": number,
      "sample": number[],
      "percentage": number[],
      "name": string,
      "pathogenic": number,
      "tsneX": number,
      "tsneY": number,
      "node_pos":number,
      "tax_id": number
    }];
    this.countTotals(d, rootReads, selectedsample);
  }

  countTotals(d: Taxon, rootReads: number[][], selectedsample: string): void {
    // console.log(d.taxon_reads.map(function(n,i){return (n/ rootReads[0][i]);}).push(d.ctrl_reads));
    let index = d.file.indexOf(selectedsample);
    // console.log(index);
    if (d.rank == "species" && d.taxon_name != "Homo sapiens" && d.taxon_reads[index]>0) {
      this.totalPoints["control"].push(d.ctrl_taxon_reads);
      this.totalPoints["sample"].push(d.taxon_reads);
      let percentarray = []
      percentarray.push(100*d.ctrl_taxon_reads/rootReads[1][0])
      this.totalPoints["percentage"].push(d.taxon_reads.map(function(n,i){return (100*n/rootReads[0][i]);}).concat(percentarray));
      this.totalPoints["name"].push(d.taxon_name);
      this.totalPoints["pathogenic"].push(d.pathogenic);
      this.totalPoints["tax_id"].push(d.tax_id);
    }

    for (let i = 0; i < d.children.length; i++) {
      this.countTotals(d.children[i], rootReads, selectedsample);
    }
  }


    sampleFindTotals(d: Taxon, rootReads: number[][]) {
      this.SamplePoints =  {
        "control": [],
        "sample": [],
        "percentage": [],
        "name": [],
        "pathogenic": [],
        "tsneX": [],
        "tsneY": [],
        "tax_id": []
      };
      this.plotSamplePoints =  Array() as [{
        // "control": number[],
        // "sample": number[],
        // "percentage": number[][],
        "name": string,
        // "pathogenic": number[],
        "tsneX":number,
        "tsneY":number,
        // "tax_id": number[][]
      }];
      for (let i = 0; i < d.taxon_reads.length; i++){
        this.SamplePoints["percentage"][i]=[];
      }
      this.sampleCountTotals(d, rootReads);
    }

  // counting for the sample comparison TSNE:
  sampleCountTotals(d: Taxon, rootReads: number[][]): void {
    if (d.rank == "species" && d.taxon_name != "Homo sapiens" && d.taxon_reads.some(x=>x>1)) {
      this.SamplePoints["control"].push(d.ctrl_taxon_reads);
      this.SamplePoints["name"].push(d.taxon_name);
      this.SamplePoints["pathogenic"].push(d.pathogenic);
      this.SamplePoints["tax_id"].push(d.tax_id);
      for (let i = 0; i < d.taxon_reads.length; i++){
        this.SamplePoints['percentage'][i].push(100*d.taxon_reads[i]/rootReads[0][i]);
      }
    }

    for (let i = 0; i < d.children.length; i++) {
      this.sampleCountTotals(d.children[i], rootReads);
    }
  }

  tsneModel(): void {
    let model = new TSNE({
      dim: this.totalPoints['sample'][0].length + 1,
      perplexity: 1.0,
      earlyExaggeration: 4,
      learningRate: 100.0,
      nIter: 5000,
      metric: 'euclidian'
    });
    model.init({
      data:this.totalPoints['percentage'],
      type: 'dense'
    });
    let [errr, iter] = model.run();
    // rerun without re-calculating pairwise distances, etc.
    [errr, iter] = model.rerun();
    // `output` is unpacked ndarray (regular nested javascript array)
    let output: number[][];
    output = model.getOutput();
    // output = model.getOutputScaled();

    for (let i = 0; i<output.length; i++){
      this.plotTotalPoints.push({
        "control": this.totalPoints['control'][i],
        "sample": this.totalPoints['sample'][i],
        "percentage": this.totalPoints['percentage'][i],
        "name": this.totalPoints['name'][i],
        "pathogenic": this.totalPoints['pathogenic'][i],
        "tsneX": output[i][0],
        "tsneY": output[i][1],
        "node_pos": 3,
        "tax_id": this.totalPoints['tax_id'][i]
      });
    }
    // `outputScaled` is `output` scaled to a range of [-1, 1]
    // let outputScaled = model.getOutputScaled();
  }

  tsneSampleModel(d: Taxon): void {
    console.log(this.SamplePoints)
    let model = new TSNE({
      dim: this.SamplePoints['name'].length,
      perplexity: 3,
      earlyExaggeration: 2,
      learningRate: 10,
      nIter: 5000,
      metric: 'manhattan'
    });
    model.init({
      data:this.SamplePoints['percentage'],
      type: 'dense'
    });
    let [errr, iter] = model.run();
    // rerun without re-calculating pairwise distances, etc.
    [errr, iter] = model.rerun();
    // `output` is unpacked ndarray (regular nested javascript array)
    let output: number[][];
    output = model.getOutputScaled();
    console.log(output);
    console.log("OUTPUT ^")
    // output = model.getOutputScaled();

    for (let i = 0; i<output.length; i++){
      this.plotSamplePoints.push({
        // "control": this.totalPoints['control'][i],
        // "sample": this.totalPoints['sample'][i],
        // "percentage": this.totalPoints['percentage'][i],
        "name": d.file[i],
        // "pathogenic": this.totalPoints['pathogenic'][i],
        "tsneX": output[i][0],
        "tsneY": output[i][1],
        // "tax_id": this.totalPoints['tax_id'][i]
      });
    }
    // `outputScaled` is `output` scaled to a range of [-1, 1]
    // let outputScaled = model.getOutputScaled();
  }

}
