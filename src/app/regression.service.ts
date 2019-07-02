import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import * as _ from "lodash";
import * as d3 from 'd3';

import { HierarchyPointNode } from 'd3-hierarchy'

import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';

import { Taxon } from './taxon';

@Injectable({
  providedIn: 'root'
})
export class RegressionService {
  private reportUrl = "./assets/json-reports/test.json";
  private jsonData: Taxon = new Taxon();
  private selectedSample: string;
  private selectedTaxon: string;
  private currentPoints = null;
  private predictedPoints = null;
  private pointCounts = null;
  private linearModel = null;
  private x = {};
  private logcontrolreads = null;
  private logtaxonreads = null;

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

  cutScores(d: Taxon, threshold: number, selectedSample: string){
    let num = d.file.indexOf(selectedSample)
    this.scoreCut(d,threshold,num);
    return d;
  }

  scoreCut(d: Taxon, threshold: number, j: number){
    let ctrlscorearray = null;
    ctrlscorearray = d.ctrl_forward_score_distribution.split(",");
    for (let k = 0; k < 10; k++) {
      if(((k/10) + 0.1)< threshold){
        if(d.ctrl_reads-ctrlscorearray[k] <= 0 || isNaN(d.ctrl_reads-ctrlscorearray[k])){
          d.ctrl_reads = 0;
        }else {
          d.ctrl_reads = d.ctrl_reads - ctrlscorearray[k]
        }
      }
    }
    // for (let j = 0; j < d.file.length; j++) {
      let cutreads = null;
      cutreads = 0;
      let scorearray = null;
      scorearray = d.forward_score_distribution[j].split(",");
      for (let k = 0; k < 10; k++) {
        if(((k/10) + 0.1)< threshold){
          if(d.reads[j]-scorearray[k] < 0){
            d.reads[j] = 0;
          }else {
            d.reads[j] = d.reads[j]-scorearray[k];
          }
        }
      }
    // }
      for (let i = 0; i < d.children.length; i++) {
        this.scoreCut(d.children[i], threshold, j);
      }
  }

  findTaxons(d: Taxon, x = {}){
    this.x[this.selectedSample]=[]
    this.x[this.selectedSample][0]=[]
    this.x[this.selectedSample][1]=[]
    this.x[this.selectedSample][2]=[]
    this.x[this.selectedSample][3]=[]
    this.searchthetree(d,this.x);
  }

  searchthetree(d: Taxon, x: {}): void{
    let index = d.file.indexOf(this.selectedSample);
    if(d.rank==this.selectedTaxon){
      if(d.reads[index]>0 && d.taxon_name!="Homo sapiens"){
        if(d.ctrl_reads<=0 ){
          this.x[this.selectedSample][0].push(0.1);
        }else{
          this.x[this.selectedSample][0].push(d.ctrl_reads+Math.random()*0.15);
        }
        if(d.reads[index]<=0){
          this.x[this.selectedSample][1].push(0.1);
        }else{
          this.x[this.selectedSample][1].push(d.reads[index]+Math.random()*0.15);
        }
        this.x[this.selectedSample][2].push(d.taxon_name);
        this.x[this.selectedSample][3].push(d.pathogenic);
      }
    }
    for (let i = 0; i < d.children.length; i++) {
      this.searchthetree(d.children[i], x);
    }
  }

  arrangePoints(d: Taxon, x: {}) {
    this.currentPoints = [];
    this.logcontrolreads = [];
    this.logtaxonreads = [];
    for (let j = 0; j< this.x[this.selectedSample][0].length; j++) {
      this.logcontrolreads.push(Math.log10(this.x[this.selectedSample][0][j]));
      this.logtaxonreads.push(Math.log10(this.x[this.selectedSample][1][j]));
      this.currentPoints.push([Math.log10(this.x[this.selectedSample][0][j]), Math.log10(this.x[this.selectedSample][1][j]), this.x[this.selectedSample][2][j], 0, this.x[this.selectedSample][3][j]]);
    };
  }

  async train(d: Taxon, current: []) {

    this.linearModel = tf.sequential();
    this.linearModel.add(tf.layers.dense({units: 1, inputShape: [1]}));
    this.linearModel.add(tf.layers.dense({units: 1}));
    this.linearModel.compile({loss: 'meanSquaredError', optimizer: 'adam'});

    const xs = tf.tensor1d(this.logcontrolreads);
    const ys = tf.tensor1d(this.logtaxonreads);

    await this.linearModel.fit(xs, ys, {"batchSize": 32, "epochs":120});

    const preds = [];
    const predictedPointsD = []
    this.predictedPoints = []
    for (let j = 1; j<d3.max(this.x[this.selectedSample][0]); j+=(d3.max(this.x[this.selectedSample][0])/10)) {
      let output = this.linearModel.predict(tf.tensor2d([Math.log10(j)], [1, 1])) as any;
      let prediction = Array.from(output.dataSync())[0]
      preds.push(prediction);
      predictedPointsD.push({x: Math.log10(j), y: prediction});
      this.predictedPoints.push({x: Math.log10(j), y: prediction})
    }

    let comparingPoints = [];
    for (let j = 0; j<this.x[this.selectedSample][0].length; j++){
      let output = this.linearModel.predict(tf.tensor2d([current[j][0]], [1, 1])) as any;
      let prediction = Array.from(output.dataSync())[0]
      if(isNaN(prediction)){
        comparingPoints.push(0);
      }else{
        comparingPoints.push(prediction);
      }
    }

    this.pointCounts=[0,0,0]
    for (let j = 0; j<this.x[this.selectedSample][0].length; j++){
      if(current[j][1] > comparingPoints[j]){
        current[j][3]=2;
        this.pointCounts[2]+=1
      }else if (Math.round(Math.pow(10,current[j][1])) == Math.round(Math.pow(10,comparingPoints[j]))){
        current[j][3]=1;
        this.pointCounts[1]+=1
      }else {
        this.pointCounts[0]+=1
      }
    }
    // document.getElementById("h1").innerHTML = '&nbsp';

    // return [this.predictedPoints, this.pointCounts];
    return [current,this.predictedPoints,this.pointCounts];
  }

  learningModel(d: Taxon, sample: string, taxon: string) {
    // document.getElementById("h1").innerHTML = "Analyzing . . .";
    this.selectedSample = sample;
    this.selectedTaxon = taxon;
    let data = _.cloneDeep(this.jsonData);
    this.x = {};
    this.findTaxons(data, this.x);
    this.arrangePoints(data, this.x);
    this.train(data, this.x);
  }

  prepareAnalysis(d: Taxon, sample: string, taxon: string) {
    // document.getElementById("h1").innerHTML = "Analyzing . . .";
    this.selectedSample = sample;
    this.selectedTaxon = taxon;
    let data = _.cloneDeep(this.jsonData);
    this.x = {};
    this.findTaxons(data, this.x);
    this.arrangePoints(data, this.x);
    return this.currentPoints;
  }

  // runPrediction(d: Taxon, sample: string, taxon: string){
  //   let data = _.cloneDeep(this.jsonData);
  //   this.train(data, this.x);
  // }

}
