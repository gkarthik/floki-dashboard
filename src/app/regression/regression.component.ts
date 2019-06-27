import { Component, OnInit, AfterViewInit } from '@angular/core';

import { Taxon } from '../taxon';

import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';

import { RegressionService } from '../regression.service';

import { HierarchyPointNode } from 'd3-hierarchy';
import { Selection } from 'd3-selection';
import { ScaleSequential } from 'd3-scale';

import * as d3 from 'd3';

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
    let currentPoints = this.regressionService.prepareAnalysis(this.jsonData, this.selectedSample, this.selectedTaxon);
    this.plot(currentPoints);
    this.regressionService.train(this.jsonData).then(p=>this.plotUpdate(currentPoints,p));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!_.isEmpty(this.jsonData)) {
      this.selectedSample = (this.jsonData["file"].length > 0) ? this.jsonData["file"][0] : "";
    }
  }

  plot(current:[]){
    var data_scatter = current;

    var padding = 50;
    var canvas_width = 800;
    var canvas_height = 500;

    var svg = d3.select("svg")
        .attr("width", canvas_width)
        .attr("height", canvas_height);
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
        .attr('id','tooltip')
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

  plotUpdate(current:[], predicted:[]): void {
    var padding = 50;
    var canvas_width = 800;
    var canvas_height = 500;
    var data_scatter = current;
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

    var svg = d3.select("svg");

    d3.selectAll("#tooltip").style("visibility", "hidden");
    svg.selectAll("*").remove();

    var data_line = predicted[0];

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

    var tooltip = d3.select("#tooltip");
        // .append("div")
        // .attr('id','tooltip')
        // .style("position", "absolute")
        // .style("z-index", "10")
        // .style("visibility", "hidden")
        // .style("background-color", "white")
        // .style("border", "solid")
        // .style("border-width", "1px")
        // .style("border-radius", "5px")
        // .style("padding", "10px");

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
        .text("In sample: "+predicted[1][2]);
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "translate("+ (canvas_width*0.88) +","+ 70+")")
        .style("font-size", "15px")
        .text("Contaminants: "+predicted[1][1]);
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "translate("+ (canvas_width*0.88) +","+ 90+")")
        .style("font-size", "15px")
        .text("Background: "+predicted[1][0]);
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
