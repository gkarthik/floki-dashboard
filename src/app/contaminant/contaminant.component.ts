import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';

import { Taxon } from '../taxon';

import { TaxonomyTreeService } from '../taxonomy-tree.service';
import { ContaminantService } from '../contaminant.service';

import * as d3 from 'd3';
import scaleSymlog from 'd3-scale';

@Component({
  selector: 'app-contaminant',
  templateUrl: './contaminant.component.html',
  styleUrls: ['./contaminant.component.css']
})
export class ContaminantComponent implements AfterViewInit, OnInit {

  constructor(
    private contaminantService: ContaminantService,
    private taxonomyTreeService: TaxonomyTreeService
  ) { }

  @ViewChild('tooltip') private tooltipEl: ElementRef;
  @ViewChild('chartWrapper') private svgEl: ElementRef;
  @ViewChild('umapWrapper') private svg2: ElementRef;
  @ViewChild('SampleumapWrapper') private svg3: ElementRef;

  private jsonData: Taxon = new Taxon();

  private selectedSample: string;
  private selectedTaxon: string;
  private scoreThreshold: number;
  private selectClusters: number;
  private xScale: d3.AxisScale<number>;
  private yScale: d3.AxisScale<number>;

  private padding: number = 50;
  private canvas_width: number = 800;
  private canvas_height: number = 500;
  private init_reads = 10000;

  ngOnInit() {
    this.contaminantService.getTree().subscribe(_ => this.onInit(_));
  }
  // on initialize: plot the sample clustering plot
  onInit(_: Taxon): void {
    this.scoreThreshold = 1;
    this.selectedTaxon = "species";
    this.selectClusters = 7;
    this.jsonData = _;
    this.contaminantService.getTree().subscribe(_ => { this.jsonData = _; });
    this.jsonData = this.taxonomyTreeService.cutScores(this.jsonData, 1);
    let rootReads = this.taxonomyTreeService.getRootReads();
    this.initializePlot();
    this.contaminantService.sampleFindTotals(this.jsonData, rootReads);
    this.contaminantService.umapSampleModel(this.jsonData);
    this.umapSamplePlot();
  }

  ngAfterViewInit() {
  }

  // creates scatter and cluster plot for the selected sample
  async realize() {
    this.contaminantService.getTree().subscribe(_ => { this.jsonData = _; });
    this.jsonData = this.taxonomyTreeService.cutScores(this.jsonData, this.scoreThreshold);
    let rootReads = this.taxonomyTreeService.getRootReads();
    // this.umapModel(this.selectedSample, rootReads).then(t => this.umapPlot());
    this.contaminantService.prepareAnalysis(this.selectedSample, this.selectedTaxon, rootReads); // Sets current points in service
    // this.updateplot();
    // let t = await this.umapModel(this.selectedSample);
    // this.umapPlot();
    // let pred = await this.contaminantService.trainAndPredict();
    this.updateplot()

    let [pred, t] = await Promise.all([this.regressionAnalysis(), this.umapModel(this.selectedSample, rootReads)])
    this.updateplot();
    this.updateLine(pred);
    this.updateCluster();
  }

  async regressionAnalysis(){
    let pred = this.contaminantService.trainAndPredict()
    return await pred;
  }

  downloadCSV() {
    let rootReads = this.taxonomyTreeService.getRootReads();
    let current = this.contaminantService.getSampleData();
    let fileNames = this.contaminantService.getFileNames();

    let csv = "data:text/csv;charset=utf-8,";

    let csvRow = []
    csvRow.push(this.selectedSample,this.selectedTaxon,this.scoreThreshold)
    csv += csvRow + "\n";
    csvRow = []
    csvRow.push("Name","Tax_ID",rootReads[1][0])
    for (let i = 0; i < rootReads[0].length; i++) {
      csvRow.push(rootReads[0][i])
    }
    csv += csvRow + "\n";
    csvRow =[]
    csvRow.push("","Labels:","control")
    for (let i = 0; i < fileNames.length; i++) {
      csvRow.push(fileNames[i])
    }
    csv += csvRow + "\n";
    for (let i = 0;i < current.name.length; i++){
      let row = []
      row.push(current.name[i], current.tax_id[i], current.control[i])
      for (let j = 0; j < current.all_samples[i].length; j++){
        row.push(current.all_samples[i][j])
      }
      csv += row + "\n";
    }

    var encodedUri = encodeURI(csv);
    window.open(encodedUri);
  }

  updateCluster() {
    this.contaminantService.updateClustering(this.selectClusters)
    this.umapPlot();
  }
  // initializes plots for later use
  initializePlot() {
    this.initializeScatterPlot();
    this.initializeumapPlot();
    this.initializeumapSamplePlot();
  }

  initializeScatterPlot() {

    let svg = d3.select(this.svgEl.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height);

    this.xScale = d3.scaleSymlog()
      .domain([0, this.init_reads])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    let xScale = this.xScale;

    this.yScale = d3.scaleSymlog()
      .domain([0, this.init_reads])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    let yScale = this.yScale;

    let xAxis = d3.axisBottom(xScale)
      .ticks(2);

    svg.append("g")
      .attr("class", "xaxis")
      .attr("transform", "translate(0," + (this.canvas_height - this.padding) + ")")
      .call(xAxis);

    let yAxis = d3.axisLeft(yScale)
      .ticks(2);

    svg.append("path")
      .attr("id", "contaminant_line")
      .attr("stroke-width", 2)
      .style("stroke-dasharray", ("3, 3"))
      .style('fill', 'none')
      .style('stroke', '#fff');

    svg.append("path")
      .attr("id", "confidence_band")
      .style('stroke', '#fff');

    svg.append("path")
      .attr("id", "lower_band")
      .attr("stroke-width", 2)
      .style("stroke-dasharray", ("3, 3"))
      .style('fill', 'none')
      .style('stroke', '#fff');

    svg.append("path")
      .attr("id", "upper_band")
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
      .text("Taxon Contaminant Analysis");

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

  initializeumapPlot() {

    let svg = d3.select(this.svg2.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height+100);

    let xline = d3.scaleLog()
      .domain([0, 1])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    let yline = d3.scaleLog()
      .domain([0, 1])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    let xAxis = d3.axisBottom(xline);

    svg.append("g")
      .attr("class", "xaxis")
      .attr("transform", "translate(0," + (this.canvas_height - this.padding) + ")")
      .call(xAxis);

    let yAxis = d3.axisLeft(yline);

    svg.append("path")
      .attr("id", "contaminant_line")
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
      .text("UMAP of Taxa in Selection");

    svg.append("text")
      .attr("transform",
        "translate(" + (this.canvas_width / 2) + " ," + (this.canvas_height - 12) + ")")
      .style("text-anchor", "middle")
      .style("font-size", "20px")
      .text("UMAP 1");

    svg.append("text")
      .attr("id", "ylabel")
      .attr("text-anchor", "middle")
      .attr("x", - (this.canvas_height - this.padding) / 2)
      .attr("y", 14)
      .style("font-size", "20px")
      .attr("transform", "rotate(-90)")
      .text("UMAP 2");

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

      // legend
    svg.append("path")
      .attr("d", d3.symbol().type(d3.symbolCircle))
      .style("fill", '#ffffff')
      .attr("transform",
        "translate(" + (150) + " ," + (this.canvas_height - 24) + ")")
      .attr("stroke-width", 0.6)
      .style("stroke", '#000000');
    svg.append("text")
      .attr("transform",
        "translate(" + (140) + " ," + (this.canvas_height - 20) + ")")
      .style("text-anchor", "end")
      .style("font-size", "16px")
      .text("In sample:");

      svg.append("path")
        .attr("d", d3.symbol().type(d3.symbolSquare))
        .style("fill", '#ffffff')
        .attr("transform",
          "translate(" + (150) + " ," + (this.canvas_height - 4) + ")")
        .attr("stroke-width", 0.6)
        .style("stroke", '#000000');
      svg.append("text")
        .attr("transform",
          "translate(" + (140) + " ," + (this.canvas_height) + ")")
        .style("text-anchor", "end")
        .style("font-size", "16px")
        .text("Contaminant:");

      svg.append("path")
        .attr("d", d3.symbol().type(d3.symbolTriangle))
        .style("fill", '#ffffff')
        .attr("transform",
          "translate(" + (150) + " ," + (this.canvas_height + 16) + ")")
        .attr("stroke-width", 0.6)
        .style("stroke", '#000000');
      svg.append("text")
        .attr("transform",
          "translate(" + (140) + " ," + (this.canvas_height + 20) + ")")
        .style("text-anchor", "end")
        .style("font-size", "16px")
        .text("Background:");

      svg.append("path")
        .attr("d", d3.symbol().type(d3.symbolCircle))
        .style("fill", '#ffffff')
        .attr("transform",
          "translate(" + (150) + " ," + (this.canvas_height + 36) + ")")
        .attr("stroke-width", 3)
        .style("stroke", '#000000');
      svg.append("path")
        .attr("d", d3.symbol().type(d3.symbolSquare))
        .style("fill", '#ffffff')
        .attr("transform",
          "translate(" + (165) + " ," + (this.canvas_height + 36) + ")")
        .attr("stroke-width", 3)
        .style("stroke", '#000000');
      svg.append("path")
        .attr("d", d3.symbol().type(d3.symbolTriangle))
        .style("fill", '#ffffff')
        .attr("transform",
          "translate(" + (180) + " ," + (this.canvas_height + 36) + ")")
        .attr("stroke-width", 3)
        .style("stroke", '#000000');
      svg.append("text")
        .attr("transform",
          "translate(" + (140) + " ," + (this.canvas_height + 40) + ")")
        .style("text-anchor", "end")
        .style("font-size", "16px")
        .text("Pathogens:");

  }

  initializeumapSamplePlot() {

    let svg = d3.select(this.svg3.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height);

    let xline = d3.scaleLog()
      .domain([0, 1])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    let yline = d3.scaleLog()
      .domain([0, 1])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    let xAxis = d3.axisBottom(xline);

    svg.append("g")
      .attr("class", "xaxis")
      .attr("transform", "translate(0," + (this.canvas_height - this.padding) + ")")
      .call(xAxis);

    let yAxis = d3.axisLeft(yline);

    svg.append("g")
      .attr("class", "yaxis")
      .attr("transform", "translate(" + this.padding + ",0)")
      .call(yAxis);

    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", "translate(" + (this.canvas_width / 2) + "," + 30 + ")")
      .style("font-size", "20px")
      .text("UMAP Analysis of all Samples");

    svg.append("text")
      .attr("transform",
        "translate(" + (this.canvas_width / 2) + " ," + (this.canvas_height - 12) + ")")
      .style("text-anchor", "middle")
      .style("font-size", "20px")
      .text("UMAP 1");

    svg.append("text")
      .attr("id", "ylabel")
      .attr("text-anchor", "middle")
      .attr("x", - (this.canvas_height - this.padding) / 2)
      .attr("y", 14)
      .style("font-size", "20px")
      .attr("transform", "rotate(-90)")
      .text("UMAP 2");

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
    let current = this.contaminantService.getCurrentPoints();
    let pointCounts = current.length;

    let a = []
    let b = []
    for (let i = 0; i < current.length; i++) {
      a.push(current[i].control);
      b.push(current[i].sample);
    }

    let svg = d3.select(this.svgEl.nativeElement);

    svg.select("#contaminant_line").style('stroke', '#fff');

    svg.select("#confidence_band").attr('opacity', '0');

    var tooltip = d3.select(this.tooltipEl.nativeElement);

    this.xScale = d3.scaleSymlog()
      .domain([0, d3.max(current, function(d) {
        return d.control;
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    let xScale = this.xScale;

    this.yScale = d3.scaleSymlog()
      .domain([0, d3.max(current, function(d) {
        return d.sample;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    let yScale = this.yScale;

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
          return 8 / (Math.log(pointCounts) / Math.log(20));
        } else {
          return 7 / (Math.log(pointCounts) / Math.log(20));
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
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " +Math.round(d.control) + "<br/>" + "Sample reads: " +Math.round(d.sample) + "<br/>" + "known pathogen");
        } else {
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " + Math.round(d.control) + "<br/>" + "Sample reads: " + Math.round(d.sample));
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
          return 8 / (Math.log(pointCounts) / Math.log(20));
        } else {
          return 7 / (Math.log(pointCounts) / Math.log(20));
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

    let tickvalX = [];
    let j = 1;
    while (Math.pow(10, j) < d3.max(current, function(d){return d.control;})){
      tickvalX.push(0.2*Math.pow(10,j))
      tickvalX.push(0.5*Math.pow(10,j))
      tickvalX.push(1*Math.pow(10,j))
      j++
    }
    let maxval = d3.max(current, function(d){return d.control;}).toPrecision(1);

    if(tickvalX[tickvalX.length-1]!=maxval){
      tickvalX.push(maxval);
    }

    let xAxis = d3.axisBottom(xScale)
      .tickValues(tickvalX);

    svg.selectAll("g.xaxis")
      .call(xAxis);

    let tickvalY = [];

    j = 1;
    while (Math.pow(10, j) < d3.max(current, function(d){return d.sample;})){
      tickvalY.push(0.2*Math.pow(10,j))
      tickvalY.push(0.5*Math.pow(10,j))
      tickvalY.push(1*Math.pow(10,j))
      j++
    }
    maxval = d3.max(current, function(d){return d.sample;}).toPrecision(1);

    if(tickvalY[tickvalY.length-1]!=maxval){
      tickvalY.push(maxval);
    }
    let yAxis = d3.axisLeft(yScale)
      .tickValues(tickvalY);

    svg.selectAll("g.yaxis")
      .call(yAxis);

    svg.select("#ylabel")
      .text(this.selectedSample + " Reads");

    svg.select("#aboveline")
      .attr("text-anchor", "middle")
      .attr("transform", "translate(" + (this.canvas_width*0.5) + "," + 100 + ")")
      .style("font-size", "30px")
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

  updateLine(pred: number[][][]) {

    let current = this.contaminantService.getCurrentPoints();
    let pointCounts = this.contaminantService.getPointCounts();
    let padding = 50;
    let canvas_width = 800;
    let canvas_height = 500;
    let svg = d3.select("svg");

    //unpack the confband and predicted points to plot lines
    let predictedVal = pred[0];
    let confidenceVal = pred[1];

    let lowerVal = pred[1].map(function(value) { return [value[0], value[2]] });
    let upperVal = pred[1].map(function(value) { return [value[0], value[3]] });

    function sortFunction(a, b) {
      if (a[0] === b[0]) {
        return 0;
      }
      else {
        return (a[0] < b[0]) ? -1 : 1;
      }
    }

    confidenceVal.sort(sortFunction);

    upperVal = upperVal.sort(sortFunction);
    lowerVal = lowerVal.sort(sortFunction);

    let xScale = this.xScale;

    this.yScale = d3.scaleSymlog()
      .domain([0, d3.max(current, function(d) {
        return d.sample;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    let yScale = this.yScale;

    var line = d3.line()
      .x(function(d) { return xScale(d[0]); })
      .y(function(d) { return yScale(d[1]); })
      .curve(d3.curveMonotoneX);

    svg.select("#contaminant_line")
      .datum(predictedVal)
      .attr("d", line)
      .attr("stroke-width", 2)
      .style("stroke-dasharray", ("3, 3"))
      .style('fill', 'none')
      .style('stroke', "#FF4533");

    svg.select("#confidence_band")
      .datum(confidenceVal)
      .attr("fill", "#FF4533")
      .attr("stroke", "none")
      .attr("opacity", 0.2)
      .attr("d", d3.area()
        .x(function(d) { return xScale(d[0]); })
        .y0(function(d) {
          return yScale(d[2]);
        })
        .y1(function(d) {
          return yScale(d[3]);
        }));

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

  async umapModel(selectedsample: string, rootReads: number[][]) {
    await this.contaminantService.umapModel(this.selectClusters).then(t=> this.umapPlot());
  }

  umapPlot() {
    let plotPoints = this.contaminantService.getPlotTotalPoints();
    let clusterStats = this.contaminantService.getClusterCounts();

    let svg = d3.select(this.svg2.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height+100);

    var tooltip = d3.select(this.tooltipEl.nativeElement);

    var clusterscale = d3.scaleLinear()
      .domain([d3.min(plotPoints, function(d) {
        return d.clusters;
      }), d3.max(plotPoints, function(d) {
        return 1 + d.clusters;
      })])
      .range([0, 1]);

    // var colorScale = d3.scaleSequential((d)=>d3.interpolateSinebow(clusterscale(d)));
    var colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

    var xScaleumap = d3.scaleLinear()
      .domain([d3.min(plotPoints, function(d) {
        return d.umapX;
      }), d3.max(plotPoints, function(d) {
        return d.umapX;
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    var yScaleumap = d3.scaleLinear()
      .domain([d3.min(plotPoints, function(d) {
        return d.umapY;
      }), d3.max(plotPoints, function(d) {
        return d.umapY;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    var symbolGenerator = d3.symbol()
      .size(100);

    var logScale = d3.scaleLog().domain([0.0000001, 5]);

    var circle = svg.selectAll(".taxon")
      .data(plotPoints);

    let circleEnter = circle.enter()
      .append("path")
      .attr("class", "taxon")
      .attr("transform", function(d) {
        return "translate(" + xScaleumap(d.umapX) + "," + yScaleumap(d.umapY) + ")";
      })
      .attr("d", d3.symbol().type(function(d) {
        if (d.node_pos == 3 || d.node_pos == 2) {
          return d3.symbolCircle;
        } else if (d.node_pos == 1) {
          return d3.symbolSquare;
        } else {
          return d3.symbolTriangle;
        }
      }))
      .style("opacity", function(d) {
        if (d.node_pos == 3) {
          return 1;
        } else if (d.node_pos == 2) {
          return 1;
        } else if (d.node_pos == 1) {
          return 0.5;
        } else {
          return 0.5;
        }
      })
      .on("mouseover", function(d) {
        d3.select(this).style("cursor", "pointer");
        if (d.pathogenic) {
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " + d.control_prct + "<br/>" + "Sample reads: " + d.sample_prct + "<br/>" + "known pathogen");
        } else {
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " + d.control_prct + "<br/>" + "Sample reads: " + d.sample_prct);
        }
      })
      .on("mousemove", function() { return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px"); })
      .on("mouseout", function() { d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden"); })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 3;
        } else {
          return 0.6;
        }
      })
      .style("stroke", function(d) {
        return '#000000';
      })
      .style("fill", function(d) {
        return colorScale(d.clusters);
      });

    circleEnter.merge(circle)
      .attr("d", d3.symbol().type(function(d) {
        if (d.node_pos == 3 || d.node_pos == 2) {
          return d3.symbolCircle;
        } else if (d.node_pos == 1) {
          return d3.symbolSquare;
        } else {
          return d3.symbolTriangle;
        }
      }))
      .style("opacity", function(d) {
        if (d.node_pos == 3) {
          return 1;
        } else if (d.node_pos == 2) {
          return 1;
        } else if (d.node_pos == 1) {
          return 1;
        } else {
          return 1;
        }
      })
      .attr("transform", function(d) {
        return "translate(" + xScaleumap(d.umapX) + "," + yScaleumap(d.umapY) + ")";
      })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 3;
        } else {
          return 0.6;
        }
      })
      .style("stroke", function(d) {
        return '#000000';
      })
      .style("fill", function(d) {
        return colorScale(d.clusters);
      });

    circle.exit()
      .remove();
  }

  umapSamplePlot() {
    let plotPoints = this.contaminantService.getPlotSamplePoints();
    let pointCounts = plotPoints.length;

    let svg = d3.select(this.svg3.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height);

    var tooltip = d3.select(this.tooltipEl.nativeElement);

    var clusterscale = d3.scaleLinear()
      .domain([d3.min(plotPoints, function(d) {
        return d.cluster;
      }), d3.max(plotPoints, function(d) {
        return d.cluster;
      })])
      .range([0, 1]);

    var colorScale = d3.scaleSequential((d) => d3.interpolateRdYlBu(clusterscale(d)));

    var xScaleumap2 = d3.scaleLinear()
      .domain([d3.min(plotPoints, function(d) {
        return d.umapX - 0.1;
      }), d3.max(plotPoints, function(d) {
        return d.umapX + 0.1;
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    var yScaleumap2 = d3.scaleLinear()
      .domain([d3.min(plotPoints, function(d) {
        return d.umapY - 0.1;
      }), d3.max(plotPoints, function(d) {
        return d.umapY + 0.1;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    svg.selectAll(".dotlabel")
      .data(plotPoints)
      .enter()
      .append("text")
      .attr("class", "dotlabel")
      .attr("x", function(d) {
        return xScaleumap2(d.umapX);
      })
      .attr("y", function(d) {
        return yScaleumap2(d.umapY);
      })
      .attr("dx", ".71em")
      .attr("dy", ".35em")
      .text((d) => d.name.replace(/MG-00/g, "").replace(/.report/g, ""));

    var circle = svg.selectAll(".taxon")
      .data(plotPoints);

    let circleEnter = circle.enter()
      .append("circle")
      .attr("class", "taxon")
      .attr("x", function(d) {
        return xScaleumap2(d.umapX);
      })
      .attr("y", function(d) {
        return yScaleumap2(d.umapY);
      })
      .attr("r", 5 / Math.log10(pointCounts))
      .attr("cx", function(d) {
        return xScaleumap2(d.umapX);
      })
      .attr("cy", function(d) {
        return yScaleumap2(d.umapY);
      })
      .on("mouseover", function(d) {
        d3.select(this).style("cursor", "pointer");
        return tooltip.style("visibility", "visible").html(d.name);
      })
      .on("mousemove", function() { return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px"); })
      .on("mouseout", function() { d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden"); })
      .style("stroke", function(d) {
        return '#000000';
      })
      .style("fill", function(d) {
        return colorScale(d.cluster);
      });

    circleEnter.merge(circle)
      .attr("x", function(d) {
        return xScaleumap2(d.umapX);
      })
      .attr("y", function(d) {
        return yScaleumap2(d.umapY);
      })
      .attr("r", 5 / Math.log10(pointCounts))
      .attr("cx", function(d) {
        return xScaleumap2(d.umapX);
      })
      .attr("cy", function(d) {
        return yScaleumap2(d.umapY);
      })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 2;
        } else {
          return 0.6;
        }
      })
      .style("stroke", function(d) {
        return '#000000';
      })
      .style("fill", function(d) {
        return colorScale(d.cluster);

      });

    circle.exit()
      .remove();
  }
}
