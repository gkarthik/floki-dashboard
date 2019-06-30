import { Component, OnInit, AfterViewInit } from '@angular/core';

import { Taxon } from '../taxon';

import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';

import { RegressionService } from '../regression.service';
// import { TaxonomyTreeService } from '../taxonomy-tree.service';

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
      private regressionService: RegressionService,
      // private taxonomyTreeService: TaxonomyTreeService
  ) { }

  private jsonData: Taxon = new Taxon();
  private linearModel: tf.Sequential = null;
  private filterednodes: Taxon = new Taxon();

  private selectedSample: string;
  private selectedTaxon: string;
  private scoreThreshold: number;

  ngOnInit() {
    this.regressionService.getTree().subscribe(_ => this.onInit(_));
  }

  onInit(_: Taxon): void {
    this.scoreThreshold = 1;
    this.selectedTaxon = "species";
    this.jsonData = _;
    this.initializePlot();
  }

  ngAfterViewInit(){

  }

  realize(){
    this.regressionService.getTree().subscribe(_ =>{this.jsonData = _;});
    this.jsonData = this.regressionService.cutScores(this.jsonData, this.scoreThreshold, this.selectedSample);
    let currentPoints = this.regressionService.prepareAnalysis(this.jsonData, this.selectedSample, this.selectedTaxon);
    this.updateplot(currentPoints);
    this.regressionService.train(this.jsonData, currentPoints).then(currentPoints=>{this.updateplot(currentPoints[0]),this.updateline(currentPoints[0],currentPoints[1])});
  }

  initializePlot(){
    let padding = 50;
    let canvas_width = 800;
    let canvas_height = 500;
    let current = 10000;

    let svg = d3.select("svg")
        .attr("width", canvas_width)
        .attr("height", canvas_height);

        d3.max(current, function(d) {
            return d[0];
        })

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

    var xScale = d3.scaleLinear()
        .domain(function(d){
          if(d3.max(current,(current, function(d) {
              return d[0];
          }))==1){
            [0, 2];
          }else{
            [0, d3.max(current, function(d) {
                return d[0];
            })]
          }
        })
        .range([padding, canvas_width - padding * 2])
        .nice();

    var xLScale = d3.scaleLog()
        .domain([1, d3.max(current, function(d) {
            return Math.pow(10,d[0])-1;
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var yScale = d3.scaleLinear()
        .domain([0, d3.max(current, function(d) {
            return d[1];
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var yLScale = d3.scaleLog()
        .domain([1, d3.max(current, function(d) {
            return Math.pow(10,d[1])-1;
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var xAxis = d3.axisBottom()
        .scale(xLScale)
        .ticks(10);

    svg.append("g")
        .attr("class", "xaxis")
        .attr("transform", "translate(0," + (canvas_height - padding) + ")")
        .call(xAxis);

    var yAxis = d3.axisLeft()
        .scale(yLScale)
        .ticks(10);

    var line = d3.line()
        .x(function(d) {return xScale(d.x); })
        .y(function(d) {return yScale(d.y); })
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .attr("id","line1")
        .attr("stroke-width", 2)
        .style("stroke-dasharray", ("3, 3"))
        .style('fill', 'none')
        .style('stroke', '#fff');

    svg.append("g")
        .attr("class", "yaxis")
        .attr("transform", "translate(" + padding + ",0)")
        .call(yAxis);

    svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "translate("+ (canvas_width/2) +","+ 30+")")
            .style("font-size", "20px")
            .text("Contaminant Analysis");

    svg.append("text")
        .attr("transform",
              "translate(" + (canvas_width/2) + " ," + (canvas_height-12) + ")")
        .style("text-anchor", "middle")
        .style("font-size", "20px")
        .text("Control Reads");

    svg.append("text")
        .attr("id", "ylabel")
        .attr("text-anchor", "middle")
        .attr("x", -((canvas_height-padding)/2))
        .attr("y", 14)
        .style("font-size", "20px")
        .attr("transform", "rotate(-90)")
        .text("Sample Reads");
  }

  updateplot(current:[]){

    let padding = 50;
    let canvas_width = 800;
    let canvas_height = 500;
    let svg = d3.select("svg");

    svg.select("#line1").style('stroke', '#fff');

    var tooltip = d3.select("#tooltip")

    var xScale = d3.scaleLinear()
        .domain([0, d3.max(current, function(d) {
            return d[0];
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var xLScale = d3.scaleLog()
        .domain([1, d3.max(current, function(d) {
            return Math.pow(10,d[0])-1;
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var yScale = d3.scaleLinear()
        .domain([0, d3.max(current, function(d) {
            return d[1];
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var yLScale = d3.scaleLog()
        .domain([1, d3.max(current, function(d) {
            return Math.pow(10,d[1])-1;
        })])
        .range([canvas_height - padding, padding])
        .nice();

    // svg.select("#line1").transition().duration(1000).style('stroke', '#fff');

    var circle = svg.selectAll("circle")
        .data(current);

    circle.attr("class", "update");

    circle.enter()
        .append("circle")
        .attr("class", "enter")
        .attr("x", function(d) {
                return xScale(d[0]);
            })
            .attr("y", function(d) {
                return yScale(d[1]);
            })
            .attr("r",  function(d){
              if(d[4]){
                return 5;
              }else{
                return 4;
              }
            })
            .attr("cx", function(d) {
                return xScale(d[0]);
            })
            .attr("cy", function(d) {
                return yScale(d[1]);
            })
            .attr("stroke-width", function(d){
              if(d[4]){
                return 2;
              }else{
                return 0.6;
              }
            })
            .style("stroke", function(d){
              if(d[4]){
                return '#E04836';
              }else{
                return '#000000';
              }
            })
            .on("mouseover", function(d){d3.select(this).style("cursor", "pointer"); return tooltip.style("visibility", "visible").html(d[2]+"<br/>"+"Control reads: "+ Math.round(Math.pow(10,d[0]))+"<br/>"+"Sample reads: "+Math.round(Math.pow(10,d[1])));})
            .on("mousemove", function(){return tooltip.style("top",(d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})
            .on("mouseout", function(){d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden");})
            .style("fill",
            function(d){
                if(d[3]==2){
                  return "#5ac1e0";
                }else if(d[3]==1){
                  return "#adadad";
                } else {
                  return "#f4aa4e";
                }
            });

    circle.attr("x", function(d) {
            return xScale(d[0]);
        })
        .attr("y", function(d) {
            return yScale(d[1]);
        })
        .attr("r",  function(d){
          if(d[4]){
            return 5;
          }else{
            return 4;
          }
        })
        .attr("cx", function(d) {
            return xScale(d[0]);
        })
        .attr("cy", function(d) {
            return yScale(d[1]);
        })
        .style("fill",
        function(d){
            if(d[3]==2){
              return "#5ac1e0";
            }else if(d[3]==1){
              return "#adadad";
            } else {
              return "#f4aa4e";
            }
        })
        .attr("stroke-width", function(d){
          if(d[4]){
            return 2;
          }else{
            return 0.6;
          }
        })
        .style("stroke", function(d){
          if(d[4]){
            return '#E04836';
          }else{
            return '#000000';
          }
        })
        .on("mouseover", function(d){d3.select(this).style("cursor", "pointer"); return tooltip.style("visibility", "visible").html(d[2]+"<br/>"+"Control reads: "+ Math.round(Math.pow(10,d[0]))+"<br/>"+"Sample reads: "+Math.round(Math.pow(10,d[1])));})
        .on("mousemove", function(){return tooltip.style("top",(d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})
        .on("mouseout", function(){d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden");});
        // .transition()
        // .duration(1000)
        // .attr("y", 0)
        // .style("fill-opacity", 1);

    circle.exit()
        .attr("class", "exit")
        // .transition()
        // .duration(1000)
        // .attr("cy", 0)
        .remove();

    var xAxis = d3.axisBottom()
        .scale(xLScale)
        .ticks(10);

    svg.selectAll("g.xaxis")
        // .attr("class", "axis")
        // .attr("transform", "translate(0," + (canvas_height - padding) + ")")
        .call(xAxis);

    var yAxis = d3.axisLeft()
        .scale(yLScale)
        .ticks(10);

    svg.selectAll("g.yaxis")
        // .attr("class", "axis")
        // .attr("transform", "translate(" + padding + ",0)")
        .call(yAxis);

    svg.select("#ylabel")
        .text(this.selectedSample+" Reads");

  }

  updateline(current:[],cline:[]){
    let padding = 50;
    let canvas_width = 800;
    let canvas_height = 500;
    var svg = d3.select("svg");

    var xScale = d3.scaleLinear()
        .domain([0, d3.max(current, function(d) {
            return d[0];
        })])
        .range([padding, canvas_width - padding * 2])
        .nice();

    var yScale = d3.scaleLinear()
        .domain([0, d3.max(current, function(d) {
            return d[1];
        })])
        .range([canvas_height - padding, padding])
        .nice();

    var line = d3.line()
        .x(function(d) {return xScale(d.x); })
        .y(function(d) {return yScale(d.y); })
        .curve(d3.curveMonotoneX);

    svg.select("#line1")
        .datum(cline)
        .attr("d", line)
        .attr("stroke-width", 2)
        .style("stroke-dasharray", ("3, 3"))
        .style('fill', 'none')
      //   .style('stroke', '#fff')
      // .transition()
      //   .delay(500)
      //   .duration(1500)
        .style('stroke', "#FF4533");
  }

}
