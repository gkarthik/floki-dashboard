import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';

import { Taxon } from '../taxon';

import { RegressionService } from '../regression.service';
// import { TaxonomyTreeService } from '../taxonomy-tree.service';

import * as d3 from 'd3';

@Component({
  selector: 'app-regression',
  templateUrl: './regression.component.html',
  styleUrls: ['./regression.component.css']
})
export class RegressionComponent implements AfterViewInit, OnInit {

  constructor(
    private regressionService: RegressionService,
  ) { }

  @ViewChild('tooltip') private tooltipEl: ElementRef;
  @ViewChild('chartWrapper') private svgEl: ElementRef;

  private jsonData: Taxon = new Taxon();

  private selectedSample: string;
  private selectedTaxon: string;
  private scoreThreshold: number;

  private padding: number = 50;
  private canvas_width: number = 800;
  private canvas_height: number = 500;
  private init_reads = 10000;

  ngOnInit() {
    this.regressionService.getTree().subscribe(_ => this.onInit(_));
  }

  onInit(_: Taxon): void {
    this.scoreThreshold = 1;
    this.selectedTaxon = "species";
    this.jsonData = _;
    this.initializePlot();
  }

  ngAfterViewInit() {

  }

  realize() {
    this.regressionService.getTree().subscribe(_ => { this.jsonData = _; });
    this.jsonData = this.regressionService.cutScores(this.jsonData, this.scoreThreshold, this.selectedSample);
    this.regressionService.prepareAnalysis(this.selectedSample, this.selectedTaxon); // Sets current points in service
    this.updateplot();
    this.regressionService.trainAndPredict().then(
      pred => {
        this.updateplot();
        this.updateline(pred);
      });
  }

  initializePlot() {

    let svg = d3.select(this.svgEl.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height);

    let xLScale = d3.scaleLog()
      .domain([1, this.init_reads])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    let yLScale = d3.scaleLog()
      .domain([1, this.init_reads])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    let xAxis = d3.axisBottom(xLScale)
      .ticks(10);

    svg.append("g")
      .attr("class", "xaxis")
      .attr("transform", "translate(0," + (this.canvas_height - this.padding) + ")")
      .call(xAxis);

    let yAxis = d3.axisLeft(yLScale)
      .ticks(10);

    svg.append("path")
      .attr("id", "regression_line")
      .attr("stroke-width", 2)
      .style("stroke-dasharray", ("3, 3"))
      .style('fill', 'none')
      .style('stroke', '#fff');

    svg.append("g")
      .attr("class", "yaxis")
      .attr("transform", "translate(" + this.padding + ",0)")
      .call(yAxis);

    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", "translate(" + (this.canvas_width / 2) + "," + 30 + ")")
      .style("font-size", "20px")
      .text("Contaminant Analysis");

    svg.append("text")
      .attr("transform",
        "translate(" + (this.canvas_width / 2) + " ," + (this.canvas_height - 12) + ")")
      .style("text-anchor", "middle")
      .style("font-size", "20px")
      .text("Control Reads");

    svg.append("text")
      .attr("id", "ylabel")
      .attr("text-anchor", "middle")
      .attr("x", - (this.canvas_height - this.padding) / 2)
      .attr("y", 14)
      .style("font-size", "20px")
      .attr("transform", "rotate(-90)")
      .text("Sample Reads");

    svg.append("text")
      .attr("text-anchor", "end")
      .attr("id", "aboveline")
      .attr("transform", "translate(" + (this.canvas_width * 0.88) + "," + 50 + ")")
      .style("font-size", "15px");

    svg.append("text")
      .attr("text-anchor", "end")
      .attr("id", "online")
      .attr("transform", "translate(" + (this.canvas_width * 0.88) + "," + 70 + ")")
      .style("font-size", "15px");

    svg.append("text")
      .attr("text-anchor", "end")
      .attr("id", "belowline")
      .attr("transform", "translate(" + (this.canvas_width * 0.88) + "," + 90 + ")")
      .style("font-size", "15px");
  }

  updateplot() {
    let current = this.regressionService.getCurrentPoints();
    let svg = d3.select("svg");

    svg.select("#regression_line").style('stroke', '#fff');

    var tooltip = d3.select(this.tooltipEl.nativeElement);

    var xScale = d3.scaleLinear()
      .domain([0, d3.max(current, function(d) {
        return d.control;
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    var xLScale = d3.scaleLog()
      .domain([1, d3.max(current, function(d) {
        return Math.pow(10, d.control);
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    var yScale = d3.scaleLinear()
      .domain([0, d3.max(current, function(d) {
        return d.sample;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    var yLScale = d3.scaleLog()
      .domain([1, d3.max(current, function(d) {
        return Math.pow(10, d.sample);
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    var circle = svg.selectAll(".taxon")
      .data(current);

    let circleEnter = circle.enter()
      .append("circle")
      .attr("class", "taxon")
      .attr("x", function(d) {
        return xScale(d.control);
      })
      .attr("y", function(d) {
        return yScale(d.sample);
      })
      .attr("r", function(d) {
        if (d.pathogenic) {
          return 5;
        } else {
          return 4;
        }
      })
      .attr("cx", function(d) {
        return xScale(d.control);
      })
      .attr("cy", function(d) {
        return yScale(d.sample);
      })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 2;
        } else {
          return 0.6;
        }
      })
      .style("stroke", function(d) {
        if (d.pathogenic) {
          return '#E04836';
        } else {
          return '#000000';
        }
      })
      .on("mouseover", function(d) {
        d3.select(this).style("cursor", "pointer");
        if (d.pathogenic) {
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " + Math.round(Math.pow(10, d.control) - 1) + "<br/>" + "Sample reads: " + Math.round(Math.pow(10, d.sample) - 1) + "<br/>" + "known pathogen");
        } else {
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " + Math.round(Math.pow(10, d.control) - 1) + "<br/>" + "Sample reads: " + Math.round(Math.pow(10, d.sample) - 1));
        }
      })
      .on("mousemove", function() { return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px"); })
      .on("mouseout", function() { d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden"); })
      .style("fill",
        function(d) {
          if (d.node_pos == 2) {
            return "#5ac1e0";
          } else if (d.node_pos == 1) {
            return "#adadad";
          } else {
            return "#f4aa4e";
          }
        });

    circleEnter.merge(circle)
      .attr("x", function(d) {
        return xScale(d.control);
      })
      .attr("y", function(d) {
        return yScale(d.sample);
      })
      .attr("r", function(d) {
        if (d.pathogenic) {
          return 5;
        } else {
          return 4;
        }
      })
      .attr("cx", function(d) {
        return xScale(d.control);
      })
      .attr("cy", function(d) {
        return yScale(d.sample);
      })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 2;
        } else {
          return 0.6;
        }
      })
      .style("stroke", function(d) {
        if (d.pathogenic) {
          return '#E04836';
        } else {
          return '#000000';
        }
      })
      .style("fill", function(d) {
        if (d.node_pos == 2) {
          return "#5ac1e0";
        } else if (d.node_pos == 1) {
          return "#adadad";
        } else {
          return "#f4aa4e";
        }
      });

    circle.exit()
      .remove();

    var xAxis = d3.axisBottom(xLScale)
      .ticks(10);

    svg.selectAll("g.xaxis")
      .call(xAxis);

    var yAxis = d3.axisLeft(yLScale)
      .ticks(10);

    svg.selectAll("g.yaxis")
      .call(yAxis);

    svg.select("#ylabel")
      .text(this.selectedSample + " Reads");

    svg.select("#aboveline")
      .attr("text-anchor", "end")
      .attr("transform", "translate(" + (this.canvas_width * 0.88) + "," + 50 + ")")
      .style("font-size", "15px")
      .text("Analyzing. . .");
    svg.select("#online")
      .attr("text-anchor", "end")
      .attr("transform", "translate(" + (this.canvas_width * 0.88) + "," + 70 + ")")
      .style("font-size", "15px")
      .text("");
    svg.select("#belowline")
      .attr("text-anchor", "end")
      .attr("transform", "translate(" + (this.canvas_width * 0.88) + "," + 90 + ")")
      .style("font-size", "15px")
      .text("");
  }

  updateline(pred: number[][]) {
    console.log(pred);
    let current = this.regressionService.getCurrentPoints();
    let pointCounts = this.regressionService.getPointCounts();
    let padding = 50;
    let canvas_width = 800;
    let canvas_height = 500;
    var svg = d3.select("svg");

    var xScale = d3.scaleLinear()
      .domain([0, d3.max(current, function(d) {
        return d.control;
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    var yScale = d3.scaleLinear()
      .domain([0, d3.max(current, function(d) {
        return d.sample;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    // var yScale = d3.scaleLinear()
    //   .domain([0, d3.max(current, function(d) {
    //     return d.sample;
    //   })])
    //   .range([canvas_height - padding, padding])
    //   .nice();

    var line = d3.line()
      .x(function(d) { return xScale(d[0]); })
      .y(function(d) { return yScale(d[1]); })
      .curve(d3.curveMonotoneX);

    svg.select("#regression_line")
      .datum(pred)
      .attr("d", line)
      .attr("stroke-width", 2)
      .style("stroke-dasharray", ("3, 3"))
      .style('fill', 'none')
      .style('stroke', "#FF4533");

    svg.select("#aboveline")
      .attr("text-anchor", "end")
      .attr("transform", "translate(" + (canvas_width * 0.88) + "," + 50 + ")")
      .style("font-size", "15px")
      .text("In sample: " + pointCounts[2]);
    svg.select("#online")
      .attr("text-anchor", "end")
      .attr("transform", "translate(" + (canvas_width * 0.88) + "," + 70 + ")")
      .style("font-size", "15px")
      .text("Contaminants: " + pointCounts[1]);
    svg.select("#belowline")
      .attr("text-anchor", "end")
      .attr("transform", "translate(" + (canvas_width * 0.88) + "," + 90 + ")")
      .style("font-size", "15px")
      .text("Background: " + pointCounts[0]);
  }
}
