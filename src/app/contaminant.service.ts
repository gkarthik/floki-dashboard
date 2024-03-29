import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import * as _ from "lodash";

import * as jStat from 'jStat';
import * as tf from '@tensorflow/tfjs';

import * as d3 from 'd3';

import kmeans from 'ml-kmeans';
var nn = require('nearest-neighbor');

const louvain = require('louvain-algorithm');

import { UMAP } from 'umap-js';

import clustering from 'density-clustering';

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
  private heatMapScale = null;
  private confInt: number[][];
  private fileNames: string[];
  private clustNum: number;
  private currentPoints: [{	// List of dict for d3 data() for scatterplot
    "control": number,
    "sample": number,
    "name": string,
    "node_pos": number,
    "pathogenic": number,
    "tax_id": number
  }];
  private plotTotalPoints: [{ // List of dict for d3 data() for clusterplot 1
    "control_prct": number,
    "sample_prct": number[],
    "percentage": number[],
    "name": string,
    "pathogenic": number,
    "umapX": number,
    "umapY": number,
    "node_pos": number,
    "tax_id": number,
    "clusters": number
  }];
  private SamplePoints: [{ // dict of lists for clusterplot 2
    "control": number[],
    "ctrl_percentage": number[],
    "sample": number[],
    "percentage": number[][],
    "name": string[],
    "pathogenic": number[],
    "umapX": number,
    "umapY": number,
    "tax_id": number[][]
  }];
  private plotSamplePoints: [{  // List of dict for d3 data() for clusterplot 2
    "name": string,
    "cluster": number,
    "umapX": number,
    "umapY": number,
  }];
  // Sample data elements
  private sampleData: { // data parsed from the tree, for the scatter plot
    "control": number[],
    "sample": number[],
    "all_samples": number[][],
    "ctrl_prct": number[],
    "sample_prct": number[][],
    "percentage": number[][],
    "name": string[],
    "node_pos": number[],
    "pathogenic": number[],
    "tax_id": number[]
  };
  private train: { //training data for the regression
    "ctrl_reads_log": number[],
    "taxa_reads_log": number[]
  }
  private pointCounts: number[]; //number of points above/below line, for scatter plot
  private clusterCounts: [{ //output from the clustering algorithmn for clusterplot 1
    "cluster": number,
    "taxa": number,
    "significant": number,
    "contaminant": number,
    "background": number,
    "avg_ctrl_percentage": number,
    "avg_sample_percentage": number[],
    "avg_sample_percent_string": string[],
    "color": number,
  }]

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

  getFileNames(){
    return this.fileNames;
  }

  getHeatMapColor(x){
    if(this.heatMapScale == null){
      return "#FFFFF";
    }
    let bgColor = this.heatMapScale(x);
    return d3.rgb(bgColor).hex();
  }

  getHeatMapTextColor(x){
    if(this.heatMapScale == null){
      return "#FFFFF";
    }
    let bgColor = this.heatMapScale(x);
    let textColor = d3.hsl(bgColor).l > 0.5 ? "#000" : "#fff";
    return textColor;
  }
  // return for csv download
  getSampleData(): {
    "control": number[],
    "sample": number[],
    "all_samples": number[][],
    "ctrl_prct": number[],
    "sample_prct": number[][],
    "percentage": number[][],
    "name": string[],
    "node_pos": number[],
    "pathogenic": number[],
    "tax_id": number[],
  } {
    return this.sampleData;
  }
  // return points for scatterplot
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
  // return points for clusterplot 1
  getPlotTotalPoints(): [{
    "control_prct": number,
    "sample_prct": number[],
    "percentage": number[],
    "name": string,
    "pathogenic": number
    "umapX": number,
    "umapY": number,
    "node_pos": number,
    "tax_id": number,
    "clusters": number
  }] {
    return this.plotTotalPoints;
  }
  // return points for clusterplot 2
  getPlotSamplePoints(): [{
    "name": string,
    "cluster": number,
    "umapX": number,
    "umapY": number,
  }] {
    return this.plotSamplePoints;
  }
  // return above/below line for scatterplot
  getPointCounts(): number[] {
    return this.pointCounts;
  }
  // return cluster information for clusterplot 1
  getClusterCounts(): [{
    "cluster": number,
    "taxa": number,
    "significant": number,
    "contaminant": number,
    "background": number,
    "avg_ctrl_percentage": number,
    "avg_sample_percentage": number[],
    "avg_sample_percent_string": string[],
    "color": number
  }] {
    return this.clusterCounts;
  }
  getConfInt(): number[][] {
    return this.confInt;
  }
  getConfLabels(): string[] {
    return ['','Intercept confidence interval'];
  }

  getTree(): Observable<any> {
    return this.http.get<any>(this.reportUrl)
      .pipe(
        tap(d => this.jsonData = d),
        catchError(this.handleError('getTree', []))
      );
  }

  // run find taxons and arrange points to prepare for training
  prepareAnalysis(sample: string, taxon: string, rootReads: number[][]) {
    this.selectedSample = sample;
    this.selectedTaxon = taxon;
    let data = _.cloneDeep(this.jsonData);
    this.findTaxons(data, rootReads);
    this.arrangePoints();
    // return this.currentPoints;
  }

  // push up data from tree into the sample data, according to taxon level
  findTaxons(d: Taxon, rootReads: number[][]) {
    this.sampleData = {
      "control": [],
      "sample": [],
      "all_samples": [],
      "ctrl_prct": [],
      "sample_prct": [],
      "percentage": [],
      "name": [],
      "node_pos": [],
      "pathogenic": [],
      "tax_id": []
    };
    this.clusterCounts = Array() as [{
      "cluster": number,
      "taxa": number,
      "significant": number,
      "contaminant": number,
      "background": number,
      "avg_ctrl_percentage": number,
      "avg_sample_percentage": number[],
      "avg_sample_percent_string": string[],
      "color": number
    }]
    this.plotTotalPoints = Array() as [{
      "control_prct": number,
      "sample_prct": number[],
      "percentage": number[],
      "name": string,
      "pathogenic": number,
      "umapX": number,
      "umapY": number,
      "node_pos": number,
      "tax_id": number,
      "clusters": number
    }];
    this.fileNames = d.file;
    this.searchTree(d, rootReads);
  }

  searchTree(d: Taxon, rootReads: number[][]): void {
    let index = d.file.indexOf(this.selectedSample);
    // d.taxon_name != "Homo sapiens" &&
    if (d.rank == this.selectedTaxon && (d.taxon_reads[index] > 0 || d.ctrl_taxon_reads > 0)) {
    // if (d.rank == this.selectedTaxon && (d.taxon_reads.some(x=> x > 0))) {
        this.sampleData["control"].push(d.ctrl_taxon_reads);
        this.sampleData["sample"].push(d.taxon_reads[index]);
        this.sampleData["all_samples"].push(d.taxon_reads);
        this.sampleData["name"].push(d.taxon_name);
        this.sampleData["pathogenic"].push(d.pathogenic);
        this.sampleData["tax_id"].push(d.tax_id);
        this.sampleData["ctrl_prct"].push(Math.round(10000*100*d.ctrl_taxon_reads / rootReads[1][0])/10000);
        this.sampleData["sample_prct"].push(d.taxon_reads.map(function(n, i) { return (Math.round(10000*100 * n / rootReads[0][i])/10000) ;}));
        let percentarray = []
        percentarray.push(100 * d.ctrl_taxon_reads / rootReads[1][0])
        this.sampleData["percentage"].push(d.taxon_reads.map(function(n, i) { return (100 * n / rootReads[0][i]); }).concat(percentarray));
    }
    for (let i = 0; i < d.children.length; i++) {
      this.searchTree(d.children[i], rootReads);
    }
  }
  // take the sample data and place it in training and currentPoints (to plot in scatterplot1)
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
      "ctrl_reads_log": _.cloneDeep(this.sampleData.control).map((x) => Math.log10(x+1)),
      "taxa_reads_log": _.cloneDeep(this.sampleData.sample).map((x) => Math.log10(x+1))
    }
    for (let j = 0; j < this.sampleData.control.length; j++) {
      this.currentPoints.push({
        "control": this.sampleData.control[j]+0.15*Math.random(),
        "sample": this.sampleData.sample[j]+0.15*Math.random(),
        "node_pos": 0,
        "name": this.sampleData.name[j],
        "pathogenic": this.sampleData.pathogenic[j],
        "tax_id": this.sampleData.tax_id[j]
      });
    };
    // find which points will be needed for the umap (based on the current points in scatterplot1)
    // for (let j = 0; j < this.plotTotalPoints.length; j++) {
    //   this.plotTotalPoints[j].node_pos = 3;
    //   for (let k = 0; k < this.currentPoints.length; k++) {
    //     if (this.currentPoints[k].tax_id == this.plotTotalPoints[j].tax_id) {
    //       this.plotTotalPoints[j].node_pos = 0;
    //     }
    //   }
    // }
  }

  // async optimization(ds, optimizer, model, loss){
  //   await ds.forEachAsync(({ x, y }) => {
  //     optimizer.minimize(() => {
  //       const predYs = model(x);
  //       const l = loss(y, predYs);
  //       return l;
  //     });
  //   });
  // }
  // train the regression and then predict points, determining which points are above or below
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

    // for (let epoch = 0; epoch < 100; epoch++) {
    //   await new Promise(resolve => setTimeout(resolve, 4));
    //   await this.optimization(ds, optimizer, model, loss);
    // }

    for (let epoch = 0; epoch < 100; epoch++) {
      await new Promise(resolve => setTimeout(resolve, 1));
      await ds.forEachAsync(({ x, y }) => {
        optimizer.minimize(() => {
          const predYs = model(x);
          const l = loss(y, predYs);
          return l;
        });
      });
    }

    // Compute confidence intervals on slope and intercept
    let trueX = tf.tensor(this.train.ctrl_reads_log);
    let meanX = tf.mean(trueX);
    let trueY = tf.tensor(this.train.taxa_reads_log);
    let n = tf.scalar(this.train.ctrl_reads_log.length);
    let predY = model(trueX).dataSync();

    let ssX = tf.sum(tf.square(trueX.sub(meanX)));
    let mse = tf.sum(tf.square(tf.sub(predY, trueY))).div(n.sub(tf.scalar(2)));
    let seM = mse.div(ssX).sqrt();
    let seC = mse.mul(tf.add(tf.scalar(1).div(n), tf.sum(tf.square(meanX)).div(ssX))).sqrt();
    let confInt = [[Math.round(m.dataSync()*1000)/1000, Math.round(m.sub(seM.mul(1.96)).dataSync()*1000)/1000, Math.round(m.add(seM.mul(1.96)).dataSync()*1000)/1000], [Math.round(1000*c.dataSync())/1000, Math.round(1000*c.sub(seC.mul(1.96)).dataSync())/1000, Math.round(1000*c.add(seC.mul(1.96)).dataSync())/1000]];
    // First element is confint on slope. Second element is confint on intercept
    this.confInt = confInt;
    // Compute confidence band
    let fitPred = Array.from(tf.stack([trueX, predY], 1).dataSync());
    let mX = meanX.dataSync()[0];
    let nVal = n.dataSync()[0];
    let tX = trueX.dataSync();
    let ssxVal = ssX.dataSync()[0];
    let mseVal = mse.dataSync()[0];
    let confBand: number[][] = [];
    for (var i = 0; i < nVal; i++) {
      let interval: number = 0;
      interval = Math.sqrt(mseVal * ((1 / nVal) + ((tX[i] - mX) ** 2) / (ssxVal))) * jStat.studentt.inv(0.975, nVal - 2); // alpha = 0.05
      confBand.push([Math.pow(10,tX[i])-1, Math.pow(10,predY[i])-1, Math.pow(10,(predY[i] - interval))-1, Math.pow(10,(predY[i] + interval))-1])
    }

    let line_x: number[] = [];
    let diff = Math.max.apply(null, this.train.ctrl_reads_log) - Math.min.apply(null, this.train.ctrl_reads_log);
    diff /= 10;
    for (let i = 0; i <= 10; i++) {
      line_x.push(i * diff + Math.min.apply(null, this.train.ctrl_reads_log));
    }
    let line_y = model(tf.tensor(line_x)).dataSync();
    let predictions: number[][] = [];
    line_x.forEach((test, i) => {
      predictions.push([Math.pow(10,test)-1, Math.pow(10,line_y[i])-1]);
    });

    this.pointCounts = Array(3).fill(0);

    for (let j = 0; j < this.currentPoints.length; j++) {
      if ((Math.pow(10,this.train.taxa_reads_log[j])-1) >= confBand[j][2] && (Math.pow(10,this.train.taxa_reads_log[j])-1) <= confBand[j][3]) {
        this.currentPoints[j].node_pos = 1;
        this.pointCounts[1] += 1
      } else if ((Math.pow(10,this.train.taxa_reads_log[j])-1) > confBand[j][3]) {
        this.currentPoints[j].node_pos = 2;
        this.pointCounts[2] += 1
      } else {
        this.pointCounts[0] += 1
      }
      for (let k = 0; k < this.plotTotalPoints.length; k++) {
        if (this.currentPoints[j].tax_id == this.plotTotalPoints[k].tax_id) {
          this.plotTotalPoints[k].node_pos = this.currentPoints[j].node_pos;
        }
      }
    }
    return [predictions, confBand];
  }

  // async dbClustering() {
  //   let umap = new UMAP({ minDist: 1});
  //   let output = umap.fit(this.totalPoints['percentage']);
  //   let dbscan = new clustering.DBSCAN();
  //   let dbclusters = dbscan.run(this.totalPoints['percentage'], 1, 1)
  //   // let ans = kmeans(this.totalPoints['percentage'], dbclusters.length, {seed: 1234567891234, initialization: 'kmeans++'});
  //   return await [output, dbclusters];
  // }

  cosine(x, y) {
    let result = 0.0;
    let normX = 0.0;
    let normY = 0.0;

    for (let i = 0; i < x.length; i++) {
      result += x[i] * y[i];
      normX += x[i] ** 2;
      normY += y[i] ** 2;
    }

    if (normX === 0 && normY === 0) {
      return 0;
    } else if (normX === 0 || normY === 0) {
      return 1.0;
    } else {
      return 1.0 - result / Math.sqrt(normX * normY);
    }
  }

  manhattan(a, b) {
    var manhattan = 0
    var dim = a.length
    for (var i = 0; i < dim; i++) {
      manhattan += Math.abs((b[i] || 0) - (a[i] || 0))
    }
    return manhattan
  }

  canberra(a, b) {
  var ii = a.length;
  var ans = 0;
  for (var i = 0; i < ii; i++) {
    ans += Math.abs(a[i] - b[i]) / (a[i] + b[i]);
  }
  return ans;
}

  // performing the umap, kmeans (or dbscan) to generate cluster plot 1 data
  async umapModel(selectClusters) {
    await new Promise(resolve => setTimeout(resolve, 3));

    // let [output, dbclusters] = await this.dbClustering();
    // let ans = Array(this.totalPoints['percentage'].length).fill(0);
    //
    // for (let i = 0; i < dbclusters.length; i++) {
    //   for (let j = 0; j < dbclusters[i].length; j++) {
    //     ans[dbclusters[i][j]] = i;
    //   }
    // }
    // let [output, ans] = await this.kmeanClustering(selectClusters);

    let trainingdata = []
    for (let i = 0; i < this.sampleData['percentage'].length; i++) {
      // trainingdata.push(_.cloneDeep(this.sampleData['percentage'][i]).map((a, j) => Math.log(1000000*a + 1)));
      trainingdata.push(_.cloneDeep(this.sampleData['percentage'][i]).map((a, j) => a));
    }

    if(trainingdata[0].length<=2){
      // var ans = await kmeans(trainingdata, selectClusters, {distance: this.manhattan, seed: 1234567891234, initialization: 'kmeans++'});
      // ans = ans['clusters'];
      // var ans = {}
      var ans = this.nearestNeighbours();

      trainingdata = []
      for (let i = 0; i < this.sampleData['percentage'].length; i++) {
        // ans[this.sampleData['name'][i]]= 0;
        trainingdata.push([Math.log10(this.sampleData.control[i]+0.15*Math.random()),Math.log10(this.sampleData.sample[i]+0.15*Math.random())])
      }
      var output = trainingdata;
    }else {
      var ans = this.nearestNeighbours();

      let umap = new UMAP({distanceFn: this.cosine, minDist: 1, nNeighbors:15, spread:10});
      var output = await umap.fit(trainingdata);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // var [output, ans] = await Promise.all([umap.fit(trainingdata), kmeans(trainingdata, selectClusters, {distance: this.manhattan, seed: 1234567891234, initialization: 'kmeans++'})]);
      // ans = ans['clusters'];
      // console.log(ans)
    }

    // await new Promise(resolve => setTimeout(resolve, 100));
    var colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    for (let i = 0; i < this.clustNum; i++) {
      this.clusterCounts[i] = {
        "cluster": i,
        "taxa": 0,
        "significant": 0,
        "contaminant": 0,
        "background": 0,
        "avg_ctrl_percentage": 0,
        "avg_sample_percentage": Array(this.sampleData['sample_prct'][0].length).fill(0),
        "avg_sample_percent_string": Array(this.sampleData['sample_prct'][0].length),
        "color": colorScale(i)
      }
    }

    for (let i = 0; i < this.sampleData["name"].length; i++) {
      this.plotTotalPoints.push({
        "control_prct": this.sampleData['ctrl_prct'][i],
        "sample_prct": this.sampleData['sample_prct'][i],
        "percentage": this.sampleData['percentage'][i],
        "name": this.sampleData['name'][i],
        "pathogenic": this.sampleData['pathogenic'][i],
        "umapX": output[i][1],
        "umapY": output[i][0],
        "node_pos": 3,
        "clusters": ans[this.sampleData['name'][i]],
        "tax_id": this.sampleData['tax_id'][i]
      });
      let samplepercents = this.sampleData['percentage'][i]
      this.clusterCounts[ans[this.sampleData['name'][i]]]['taxa'] += 1;
      this.clusterCounts[ans[this.sampleData['name'][i]]]['avg_ctrl_percentage'] += this.sampleData['percentage'][i][this.sampleData['percentage'][i].length-1];
      this.clusterCounts[ans[this.sampleData['name'][i]]]['avg_sample_percentage'] = this.clusterCounts[ans[this.sampleData['name'][i]]]['avg_sample_percentage'].map((a, j) => a + samplepercents[j]);
    }

    for (let i = 0; i < this.clustNum; i++) {
      this.clusterCounts[i]['avg_ctrl_percentage'] = this.clusterCounts[i]['avg_ctrl_percentage'] / this.clusterCounts[i]['taxa'];
      for (let j = 0; j < this.clusterCounts[i]['avg_sample_percentage'].length; j++) {
        if ((this.clusterCounts[i]['avg_sample_percentage'][j] / this.clusterCounts[i]['taxa']) >= 0.001 || (this.clusterCounts[i]['avg_sample_percentage'][j] / this.clusterCounts[i]['taxa']) == 0) {
          this.clusterCounts[i]["avg_sample_percent_string"][j] = String(Math.round((this.clusterCounts[i]['avg_sample_percentage'][j] / this.clusterCounts[i]['taxa']) * 1000) / 1000);
        } else {
          this.clusterCounts[i]["avg_sample_percent_string"][j] = String((this.clusterCounts[i]['avg_sample_percentage'][j] / this.clusterCounts[i]['taxa']).toExponential(2));
        }
        this.clusterCounts[i]['avg_sample_percentage'][j] = Number(Math.round((this.clusterCounts[i]['avg_sample_percentage'][j] / this.clusterCounts[i]['taxa']) * 1000) / 1000);
      }
    }

    let minPercentage = d3.min(this.clusterCounts, function(arr) {
      let m = d3.min(arr["avg_sample_percentage"]);
      m = d3.min([m, arr["avg_ctrl_percentage"]]);
      return m;
    });;
    let maxPercentage = d3.max(this.clusterCounts, function(arr) {
      let m = d3.max(arr["avg_sample_percentage"]);
      m = d3.max([m, arr["avg_ctrl_percentage"]]);
      return m;
    });

    let logScale = d3.scaleLog().base(1000)
      .domain([1+minPercentage, 1+maxPercentage])
    this.heatMapScale = d3.scaleSequential(
        (d) => d3.interpolateYlGnBu(logScale(d))
      );
  }

  // update cluster plot 1 data according to the regression line
  async updateClustering(selectClusters) {
  this.clusterCounts = Array() as[{
    "cluster": number,
    "taxa": number,
    "significant": number,
    "contaminant": number,
    "background": number,
    "avg_ctrl_percentage": number,
    "avg_sample_percentage": number[],
    "avg_sample_percent_string": string[],
    "color": number
  }]

  // let trainingdata = []
  // for (let i = 0; i < this.sampleData['percentage'].length; i++) {
  //   trainingdata.push(this.sampleData['percentage'][i].map((a, j) => Math.log(1000000*a + 1)));
  // }
  // this.sampleData['percentage']
  // let ans = kmeans(trainingdata, selectClusters, {seed: 1234567891234, initialization: 'kmeans++'});
  // ans = ans['clusters']
  let ans = this.nearestNeighbours();

  var colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

  for (let i = 0; i < this.clustNum; i++){
    this.clusterCounts[i]={
      "cluster":i,
      "taxa": 0,
      "significant": 0,
      "contaminant": 0,
      "background": 0,
      "avg_ctrl_percentage": 0,
      "avg_sample_percentage": Array(this.sampleData['percentage'][0].length).fill(0),
      "avg_sample_percent_string":  Array(this.sampleData['percentage'][0].length),
      "color": colorScale(i)
    }
  }

  for (let i = 0; i<this.plotTotalPoints.length; i++){
    this.plotTotalPoints[i]["clusters"]=ans[this.sampleData['name'][i]]
    if(this.currentPoints[i]['node_pos']==2){
      this.clusterCounts[ans[this.sampleData['name'][i]]]['significant'] += 1;
    }else if (this.currentPoints[i]['node_pos']==1){
      this.clusterCounts[ans[this.sampleData['name'][i]]]['contaminant'] += 1;
    }else {
      this.clusterCounts[ans[this.sampleData['name'][i]]]['background'] += 1;
    }
    this.clusterCounts[ans[this.sampleData['name'][i]]]['taxa']+=1;
    this.clusterCounts[ans[this.sampleData['name'][i]]]['avg_ctrl_percentage']+=this.sampleData['percentage'][i][this.sampleData['percentage'][i].length-1];
    this.clusterCounts[ans[this.sampleData['name'][i]]]['avg_sample_percentage']=this.clusterCounts[ans[this.sampleData['name'][i]]]['avg_sample_percentage'].map((a, j)=> a+this.sampleData['percentage'][i][j]);
  }

  for (let i = 0; i < this.clustNum; i++){
    this.clusterCounts[i]['avg_ctrl_percentage']=this.clusterCounts[i]['avg_ctrl_percentage']/this.clusterCounts[i]['taxa'];
    for (let j = 0; j < this.clusterCounts[i]['avg_sample_percentage'].length; j++){
      if((this.clusterCounts[i]['avg_sample_percentage'][j]/this.clusterCounts[i]['taxa'])>= 0.001 || (this.clusterCounts[i]['avg_sample_percentage'][j]/this.clusterCounts[i]['taxa']) == 0){
        this.clusterCounts[i]["avg_sample_percent_string"][j]= String(Math.round((this.clusterCounts[i]['avg_sample_percentage'][j]/this.clusterCounts[i]['taxa'])*1000)/1000);
      }else {
        this.clusterCounts[i]["avg_sample_percent_string"][j]= String((this.clusterCounts[i]['avg_sample_percentage'][j]/this.clusterCounts[i]['taxa']).toExponential(2));
      }
      this.clusterCounts[i]['avg_sample_percentage'][j]=Number(Math.round((this.clusterCounts[i]['avg_sample_percentage'][j]/this.clusterCounts[i]['taxa'])*1000)/1000);
      }
    }

    let minPercentage = d3.min(this.clusterCounts, function(arr) {
      return d3.min(arr["avg_sample_percentage"]);
    });
    let maxPercentage = d3.max(this.clusterCounts, function(arr) {
      return d3.max(arr["avg_sample_percentage"]);
    });

    let logScale = d3.scaleLog().base(1000)
      .domain([1+minPercentage, 1+maxPercentage])
    this.heatMapScale = d3.scaleSequential(
        (d) => d3.interpolateYlGnBu(logScale(d))
      );
  }

  // get the data of all samples, to be displayed in clusterplot 2
  sampleFindTotals(d: Taxon, rootReads: number[][]) {
    this.SamplePoints = {
      "control": [],
      "ctrl_percentage": [],
      "sample": [],
      "percentage": [],
      "name": [],
      "pathogenic": [],
      "umapX": [],
      "umapY": [],
      "tax_id": []
    };
    this.plotSamplePoints = Array() as [{
      "name": string,
      "cluster": number,
      "umapX": number,
      "umapY": number,
    }];
    for (let i = 0; i < d.taxon_reads.length; i++) {
      this.SamplePoints["percentage"][i] = [];
    }
    this.sampleCountTotals(d, rootReads);
  }

  // counting for the sample comparison umap:
  sampleCountTotals(d: Taxon, rootReads: number[][]): void {
    // setting .som >100 increases consistency of plot
     // && d.taxon_name != "Homo sapiens"
    if (d.rank == "species" && d.taxon_reads.some(x => x > 0)) {
      this.SamplePoints["control"].push(d.ctrl_taxon_reads);
      this.SamplePoints["name"].push(d.taxon_name);
      this.SamplePoints["pathogenic"].push(d.pathogenic);
      this.SamplePoints["tax_id"].push(d.tax_id);
      this.SamplePoints["ctrl_percentage"].push(100 * d.ctrl_taxon_reads / rootReads[1][0])
      for (let i = 0; i < d.taxon_reads.length; i++) {
        this.SamplePoints['percentage'][i].push(100 * d.taxon_reads[i] / rootReads[0][i]);
      }
    }

    for (let i = 0; i < d.children.length; i++) {
      this.sampleCountTotals(d.children[i], rootReads);
    }
  }

  umapSampleModel(d: Taxon): void {

    let umapsampledata = this.SamplePoints['percentage'].concat([this.SamplePoints['ctrl_percentage']])

    let umap = new UMAP({distanceFn: this.manhattan, minDist: 1, nNeighbors: 3 });
    let output = umap.fit(umapsampledata);

    let names = d.file.concat(['ctrl']);

    // let dbscan = new clustering.DBSCAN();
    // let dbclusters = dbscan.run(umapsampledata, 2, 1);
    // console.log(dbclusters);
    //
    // let ans = Array(names.length).fill(0);;
    // for (let i = 0; i < dbclusters.length; i++) {
    //   for (let j = 0; j < dbclusters[i].length; j++) {
    //     ans[dbclusters[i][j]] = i;
    //   }
    // }

    let ans = kmeans(umapsampledata, 4, {distance: this.manhattan, seed:123123456789, initialization: 'kmeans++'});
    ans = ans['clusters']

    for (let i = 0; i < output.length; i++) {
      this.plotSamplePoints.push({
        "name": names[i],
        "cluster": ans[i],
        "umapX": output[i][1],
        "umapY": output[i][0],
      });
    }
  }

// louvain on nearest neighbor graph
  nearestNeighbours() {
    let haystack = []
    for (let i = 0; i<this.sampleData["name"].length; i++) {
      haystack.push({"name": this.sampleData["name"][i], "percentage": this.sampleData["percentage"][i]});
    }

    let k = 5;
    let edge_data = [];
    for (let i = 0; i< haystack.length; i++) {
      let dist;
      let distArr = [];
      for (let j = 0; j< haystack.length; j++) {
        dist = this.cosine(haystack[i]["percentage"], haystack[j]["percentage"]);
        if(dist < 0){
          dist = 0;
        }
        if(i != j){
          distArr.push([dist,j])
        }
        // if (dist < minDist && i != j){
        //   minDist = dist;
        //   minPos = j;
        // }
        // let dist = this.manhattan(haystack[i]["percentage"], haystack[j]["percentage"]);
      }
      distArr.sort(function(a, b) {
        return a[0]-b[0];
      });
      for (let k = 0; k < 4; k++){
        edge_data.push({source: haystack[i]["name"], target: haystack[distArr[k][1]]["name"], weight: distArr[k][0]})
      }
      // edge_data.push({source: haystack[i]["name"], target: haystack[minPos]["name"], weight: minDist})
    }

    // nn.comparisonMethods.manhattan = function(a, b) {
    //   var manhattan = 0
    //   var dim = a.length
    //   for (var i = 0; i < dim; i++) {
    //     manhattan += Math.abs((b[i] || 0) - (a[i] || 0))
    //   }
    //   return manhattan;
    // }
    //
    // nn.comparisonMethods.cosine = function(x, y) {
    //   let result = 0.0;
    //   let normX = 0.0;
    //   let normY = 0.0;
    //
    //   for (let i = 0; i < x.length; i++) {
    //     result += x[i] * y[i];
    //     normX += x[i] ** 2;
    //     normY += y[i] ** 2;
    //   }
    //
    //   if (normX === 0 && normY === 0) {
    //     return 0;
    //   } else if (normX === 0 || normY === 0) {
    //     return 1.0;
    //   } else {
    //     return 1.0 - result / Math.sqrt(normX * normY);
    //   }
    // }

    // let fields = []
    // fields[0]={}
    // fields[0]["name"]="percentage";
    // fields[0]["measure"]=nn.comparisonMethods.cosine;
    //
    // let edge_data = []
    // for (let i = 0; i< haystack.length; i++) {
    //   let query = haystack[i]
    //   nn.findMostSimilar(query, haystack, fields, function(nearestNeighbor, probability) {
    //     edge_data.push({source: query["name"], target: nearestNeighbor["name"], weight: probability})
    //   });

    let samplenames = _.cloneDeep(this.sampleData["name"])

    let community = louvain.jLouvain(samplenames, edge_data, 0.00000001);

    let ans = community;

    let counts = {}
    for (let i = 0; i < this.sampleData['name'].length; i++){
      counts[community[this.sampleData['name'][i]]]=0
    }
    for (let i = 0; i < this.sampleData['name'].length; i++){
      counts[community[this.sampleData['name'][i]]]+=1
    }

    this.clustNum = Object.keys(counts).length;

    return ans;
  }

}
