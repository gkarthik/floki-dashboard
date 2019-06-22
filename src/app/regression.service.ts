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
      x[this.selectedSample]=[]
      x[this.selectedSample][0]=[]
      x[this.selectedSample][1]=[]
      x[this.selectedSample][2]=[]
    }
    this.searchthetree(d,x);
  }

  searchthetree(d: Taxon, x: {}): void{
    let index = d.file.indexOf(this.selectedSample);
    if(d.rank==this.selectedTaxon){
      if(d.taxon_reads[index]>0 && d.ctrl_reads>0){
        if(d.ctrl_reads<=0 || d.taxon_name=="Homo sapiens"){
          x[this.selectedSample][0].push(1);
        }else{
          x[this.selectedSample][0].push(d.ctrl_reads);
        }
        if(d.taxon_reads[index]<=0 || d.taxon_name=="Homo sapiens"){
          x[this.selectedSample][1].push(1);
        }else{
          x[this.selectedSample][1].push(d.taxon_reads[index]);
        }
        x[this.selectedSample][2].push(d.taxon_name)
      }
    }
    for (let i = 0; i < d.children.length; i++) {
      this.searchthetree(d.children[i], x);
    }
  }

  async train(d: Taxon, x: {}) {
    this.currentPoints = [];
    let valuesD = []
    let values = []
    let logvaluesD = []
    let logvalues = []
    let controlreads = []
    let logcontrolreads = []
    let taxonreads = []
    let logtaxonreads = []
    for (let j = 0; j< x[this.selectedSample][0].length; j++) {
      logvaluesD.push({x: Math.log10(x[this.selectedSample][0][j]), y: Math.log10(x[this.selectedSample][1][j])});
      logvalues.push([Math.log10(x[this.selectedSample][0][j]),Math.log10(x[this.selectedSample][1][j])])
      valuesD.push({x: x[this.selectedSample][0][j], y: x[this.selectedSample][1][j]});
      values.push([x[this.selectedSample][0][j],x[this.selectedSample][1][j]])
      controlreads.push(x[this.selectedSample][0][j]);
      taxonreads.push(x[this.selectedSample][1][j]);
      logcontrolreads.push(Math.log10(x[this.selectedSample][0][j]));
      logtaxonreads.push(Math.log10(x[this.selectedSample][1][j]));
      this.currentPoints.push([Math.log10(x[this.selectedSample][0][j]), Math.log10(x[this.selectedSample][1][j]), x[this.selectedSample][2][j], 0]);
    };

    this.plot();

    // let surface = { name: 'scatterplot'};
    // tfvis.render.scatterplot(
    //   surface,
    //   // document.getElementById('plot1'),
    //   {values: valuesD},
    //   {
    //     xLabel: 'Control Reads',
    //     yLabel: 'Taxon Reads',
    //     height: 300
    //   }
    // );

    let linearModel = tf.sequential();
    linearModel.add(tf.layers.dense({units: 1, inputShape: [1]}));
    linearModel.add(tf.layers.dense({units: 1}));
    linearModel.compile({loss: 'meanSquaredError', optimizer: 'adam'});

    const xs = tf.tensor1d(logcontrolreads);
    const ys = tf.tensor1d(logtaxonreads);

    await linearModel.fit(xs, ys, {"batchSize": 32, "epochs":130});

    const preds = [];
    const predictedPointsD = []
    this.predictedPoints = []
    for (let j = 1; j<d3.max(x[this.selectedSample][0]); j+=(d3.max(x[this.selectedSample][0])/10)) {
      let output = linearModel.predict(tf.tensor2d([Math.log10(j)], [1, 1])) as any;
      let prediction = Array.from(output.dataSync())[0]
      preds.push(prediction);
      predictedPointsD.push({x: Math.log10(j), y: prediction});
      this.predictedPoints.push({x: Math.log10(j), y: prediction})
    }

    let comparingPoints = [];
    for (let j = 0; j<controlreads.length; j++){
      let output = linearModel.predict(tf.tensor2d([Math.log10(controlreads[j])], [1, 1])) as any;
      let prediction = Array.from(output.dataSync())[0]
      if(isNaN(prediction)){
        comparingPoints.push(0);
      }else{
        comparingPoints.push(prediction);
      }
    }

    this.pointCounts=[0,0,0]
    for (let j = 0; j<this.currentPoints.length; j++){
      if(this.currentPoints[j][1] > comparingPoints[j]){
        this.currentPoints[j][3]=2;
        this.pointCounts[2]+=1
      }else if (Math.round(Math.pow(10,this.currentPoints[j][1])) == Math.round(Math.pow(10,comparingPoints[j]))){
        this.currentPoints[j][3]=1;
        this.pointCounts[1]+=1
      }else {
        this.pointCounts[0]+=1
      }
    }
    this.plot();
    this.plotUpdate();

    document.getElementById("h1").innerHTML = '';
    // &nbsp
    //
    // let surface = { name: 'scatterplot'};
    //
    // tfvis.render.scatterplot(
    //   surface,
    //   // document.getElementById('plot2'),
    //   {values: [logvaluesD, predictedPointsD], series: ['current', 'regression']},
    //   {
    //     xLabel: 'Control Reads',
    //     yLabel: 'Taxon Reads',
    //     height: 300
    //   }
    // );

    // let surface = { name: 'Control Reads'};
    //   tfvis.render.histogram(surface, controlreads, ({maxBins: 500, width :1000, height: 200}));
    //
    // let surface = { name: 'Taxon Reads'};
    //   tfvis.render.histogram(surface, taxonreads, ({maxBins: 500, width :1000, height: 200}));
  }

  plot() {
    var data_scatter = this.currentPoints

    var padding = 50
    var canvas_width = 800
    var canvas_height = 500

    var svg = d3.select("svg")
        .attr("width", canvas_width)
        .attr("height", canvas_height)

    svg.selectAll("*").remove();

    var xScale = d3.scaleLinear()
        .domain([0, d3.max(data_scatter, function(d) {
            return d[0];
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var xLScale = d3.scaleLog()
        .domain([1, d3.max(data_scatter, function(d) {
            return Math.pow(10,d[0])-1;
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var yScale = d3.scaleLinear()
        .domain([0, d3.max(data_scatter, function(d) {
            return d[1];
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var yLScale = d3.scaleLog()
        .domain([1, d3.max(data_scatter, function(d) {
            return Math.pow(10,d[1])-1;
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("padding", "10px");

    svg.selectAll("circle")
        .data(data_scatter)
        .enter()
        .append("circle")
        .attr("x", function(d) {
            return xScale(d[0])+Math.random()*4;
        })
        .attr("y", function(d) {
            return yScale(d[1])-Math.random()*4;
        })
        .attr("r", 3)  // Radius
        .attr("cx", function(d) {
            return xScale(d[0])+Math.random()*4;
        })
        .attr("cy", function(d) {
            return yScale(d[1])-Math.random()*4;
        })
        .attr("stroke-width", 0.6)
        .style("stroke", "#000000")
        .style("fill",
        function(d){
            if(d[3]==2){
              return "#4682B4";
            }else if(d[3]==1){
              return "#FF4533";
            } else {
              return "#f4aa4e";
            }
        })
        .on("mouseover", function(d){d3.select(this).style("cursor", "pointer"); return tooltip.style("visibility", "visible").html(d[2]+"<br/>"+"Control reads: "+ Math.round(Math.pow(10,d[0]))+"<br/>"+"Sample reads: "+Math.round(Math.pow(10,d[1])));})
        .on("mousemove", function(){return tooltip.style("top",(d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})
        .on("mouseout", function(){d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden");});

    var xAxis = d3.axisBottom()
        .scale(xLScale)
        .ticks(10);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + (canvas_height - padding) + ")")
        .call(xAxis);

    var yAxis = d3.axisLeft()
        .scale(yLScale)
        .ticks(10);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + padding + ",0)")
        .call(yAxis);

    svg.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "middle")
        .attr("x", -((canvas_height-padding)/2))
        .attr("y", 14)
        .style("font-size", "20px")
        .attr("transform", "rotate(-90)")
        .text(this.selectedSample+" Reads");

    svg.append("text")
        .attr("transform",
              "translate(" + (canvas_width/2) + " ," + (canvas_height-12) + ")")
        .style("text-anchor", "middle")
        .style("font-size", "20px")
        .text("Control Reads");

    svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "translate("+ (canvas_width/2) +","+ 30+")")
            .style("font-size", "20px")
            .text("Contaminant Analysis");
  }

  plotUpdate() {
    var padding = 50
    var canvas_width = 800
    var canvas_height = 500
    var data_scatter = this.currentPoints
    var xScale = d3.scaleLinear()
        .domain([0, d3.max(data_scatter, function(d) {
            return d[0];
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var xLScale = d3.scaleLog()
        .domain([1, d3.max(data_scatter, function(d) {
            return Math.pow(10,d[0])-1;
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var yScale = d3.scaleLinear()
        .domain([0, d3.max(data_scatter, function(d) {
            return d[1];
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var yLScale = d3.scaleLog()
        .domain([1, d3.max(data_scatter, function(d) {
            return Math.pow(10,d[1])-1;
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var svg = d3.select("svg")

    svg.selectAll("*").remove();

    var data_line = this.predictedPoints

    var line = d3.line()
        .x(function(d) {return xScale(d.x); })
        .y(function(d) {return yScale(d.y); })
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(data_line)
        .attr("d", line)
        .attr("stroke-width", 2)
        .style("stroke-dasharray", ("3, 3"))
        .style('fill', 'none')
        .style('stroke', '#fff')
      .transition()
        .delay(500)
        .duration(1500)
        .style('stroke', "#FF4533")

    var tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("padding", "10px");

    svg.selectAll("circle")
        .data(data_scatter)
        .enter()
        .append("circle")
        .attr("x", function(d) {
            return xScale(d[0])+Math.random()*4;
        })
        .attr("y", function(d) {
            return yScale(d[1])-Math.random()*4;
        })
        .attr("r", 3)  // Radius
        .attr("cx", function(d) {
            return xScale(d[0])+Math.random()*4;
        })
        .attr("cy", function(d) {
            return yScale(d[1])-Math.random()*4;
        })
        .attr("stroke-width", 0.6)
        .style("stroke", "#000000")
        .style("fill",
        function(d){
            if(d[3]==2){
              return "#4682B4";
            }else if(d[3]==1){
              return "#FF4533";
            } else {
              return "#f4aa4e";
            }
        })
        .on("mouseover", function(d){d3.select(this).style("cursor", "pointer"); return tooltip.style("visibility", "visible").html(d[2]+"<br/>"+"Control reads: "+ Math.round(Math.pow(10,d[0]))+"<br/>"+"Sample reads: "+Math.round(Math.pow(10,d[1])));})
        .on("mousemove", function(){return tooltip.style("top",(d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})
        .on("mouseout", function(){d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden");});

    var xAxis = d3.axisBottom()
        .scale(xLScale)
        .ticks(10);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + (canvas_height - padding) + ")")
        .call(xAxis);

    var yAxis = d3.axisLeft()
        .scale(yLScale)
        .ticks(10);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + padding + ",0)")
        .call(yAxis);

    svg.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "middle")
        .attr("x", -((canvas_height-padding)/2))
        .attr("y", 14)
        .style("font-size", "20px")
        .attr("transform", "rotate(-90)")
        .text(this.selectedSample+" Reads");

    svg.append("text")
        .attr("transform",
              "translate(" + (canvas_width/2) + " ," + (canvas_height-12) + ")")
        .style("text-anchor", "middle")
        .style("font-size", "20px")
        .text("Control Reads");

    svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "translate("+ (canvas_width/2) +","+ 30+")")
            .style("font-size", "20px")
            .text("Contaminant Analysis");

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "translate("+ (canvas_width*0.88) +","+ 50+")")
        .style("font-size", "15px")
        .text("In sample: "+this.pointCounts[2]);
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "translate("+ (canvas_width*0.88) +","+ 70+")")
        .style("font-size", "15px")
        .text("Contaminants: "+this.pointCounts[1]);
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "translate("+ (canvas_width*0.88) +","+ 90+")")
        .style("font-size", "15px")
        .text("Background: "+this.pointCounts[0]);
  }

  learningModel(d: Taxon, sample: string, taxon: string) {
    document.getElementById("h1").innerHTML = "Analyzing . . .";
    this.selectedSample = sample;
    this.selectedTaxon = taxon;
    let data = _.cloneDeep(this.jsonData);
    let x={};
    this.findTaxons(data, x);
    this.train(data, x);
  }

}
