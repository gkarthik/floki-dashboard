import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';

import { Taxon } from '../taxon';

import { TaxonomyTreeService } from '../taxonomy-tree.service';
import { ContaminantService } from '../contaminant.service';

import * as d3 from 'd3';

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
  @ViewChild('tsneWrapper') private svg2: ElementRef;
  @ViewChild('SampletsneWrapper') private svg3: ElementRef;

  private jsonData: Taxon = new Taxon();

  private selectedSample: string;
  private selectedTaxon: string;
  private scoreThreshold: number;

  private padding: number = 50;
  private canvas_width: number = 800;
  private canvas_height: number = 500;
  private init_reads = 10000;

  ngOnInit() {
    this.contaminantService.getTree().subscribe(_ => this.onInit(_));
  }

  onInit(_: Taxon): void {
    this.scoreThreshold = 1;
    this.selectedTaxon = "species";
    this.jsonData = _;
    this.contaminantService.getTree().subscribe(_ => { this.jsonData = _; });
    this.jsonData = this.taxonomyTreeService.cutScores(this.jsonData, 0.8);
    let rootReads = this.taxonomyTreeService.getRootReads();
    this.initializePlot();
    this.contaminantService.sampleFindTotals(this.jsonData, rootReads);
    this.contaminantService.tsneSampleModel(this.jsonData);
    this.tsneSamplePlot();
  }

  ngAfterViewInit() {
  }

  realize() {
    this.contaminantService.getTree().subscribe(_ => { this.jsonData = _; });
    this.jsonData = this.taxonomyTreeService.cutScores(this.jsonData, this.scoreThreshold);
    this.tsneModel(this.selectedSample);
    this.contaminantService.prepareAnalysis(this.selectedSample, this.selectedTaxon); // Sets current points in service
    this.updateplot()
    this.tsnePlot();
    this.contaminantService.trainAndPredict().then(
      pred => {
        this.updateplot(),
        this.tsnePlot(),
        this.updateline(pred)
      });
  }

  initializePlot(){
    this.initializeScatterPlot();
    this.initializeTsnePlot();
    this.initializeTsneSamplePlot();
  }

  initializeScatterPlot() {

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

      document.getElementById("loadingText").innerHTML = "Select a sample from the dropdown";
  }

  initializeTsnePlot() {

    let svg = d3.select(this.svg2.nativeElement)
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

    let yAxis = d3.axisLeft(yline)
      .ticks(10);

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
      .text("t-SNE Analysis");

    svg.append("text")
      .attr("transform",
        "translate(" + (this.canvas_width / 2) + " ," + (this.canvas_height - 12) + ")")
      .style("text-anchor", "middle")
      .style("font-size", "20px")
      .text("TSNE 1");

    svg.append("text")
      .attr("id", "ylabel")
      .attr("text-anchor", "middle")
      .attr("x", - (this.canvas_height - this.padding) / 2)
      .attr("y", 14)
      .style("font-size", "20px")
      .attr("transform", "rotate(-90)")
      .text("TSNE 2");

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

  initializeTsneSamplePlot() {

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

    let yAxis = d3.axisLeft(yline)
      .ticks(10);

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
      .text("t-SNE Analysis of Samples");

    svg.append("text")
      .attr("transform",
        "translate(" + (this.canvas_width / 2) + " ," + (this.canvas_height - 12) + ")")
      .style("text-anchor", "middle")
      .style("font-size", "20px")
      .text("TSNE 1");

    svg.append("text")
      .attr("id", "ylabel")
      .attr("text-anchor", "middle")
      .attr("x", - (this.canvas_height - this.padding) / 2)
      .attr("y", 14)
      .style("font-size", "20px")
      .attr("transform", "rotate(-90)")
      .text("TSNE 2");

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
    console.log(current);
    let svg = d3.select(this.svgEl.nativeElement);

    svg.select("#contaminant_line").style('stroke', '#fff');

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

    console.log('update!');
  }

  updateline(pred: number[][]) {
    console.log(pred);
    let current = this.contaminantService.getCurrentPoints();
    let pointCounts = this.contaminantService.getPointCounts();
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

    svg.select("#contaminant_line")
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

  tsneModel(selectedsample: string){
    console.log(selectedsample);
    // let reducedTree = this.taxonomyTreeService.cutScores(this.jsonData, 0.7);
    let rootReads = this.taxonomyTreeService.getRootReads();
    this.contaminantService.findTotals(this.jsonData, rootReads, selectedsample);
    let model = this.contaminantService.tsneModel();
    // this.tsnePlot();
    return model;
  }

  tsnePlot(){
    let plotpoints = this.contaminantService.getPlotTotalPoints();
    let svg = d3.select(this.svg2.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height);

    var tooltip = d3.select(this.tooltipEl.nativeElement);

    var clusterscale = d3.scaleLinear()
      .domain([d3.min(plotpoints, function(d) {
        return d.clusters;
      }), d3.max(plotpoints, function(d) {
        return d.clusters;
      })])
      .range([0, 1]);

    var colorScale = d3.scaleSequential((d)=>d3.interpolateRdYlBu(clusterscale(d)));

    var xScale = d3.scaleLinear()
      .domain([d3.min(plotpoints, function(d) {
        return d.tsneX;
      }), d3.max(plotpoints, function(d) {
        return d.tsneX;
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    var yScale = d3.scaleLinear()
      .domain([d3.min(plotpoints, function(d) {
        return d.tsneY;
      }), d3.max(plotpoints, function(d) {
        return d.tsneY;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    var logScale = d3.scaleLog().domain([0.0000001, 5])

    // var colorScale = d3.scaleSequential((d)=>d3.interpolateRdYlBu(logScale(d)));

    var circle = svg.selectAll(".taxon")
      .data(plotpoints);

    let circleEnter = circle.enter()
      .append("circle")
      .attr("class", "taxon")
      .attr("x", function(d) {
        return xScale(d.tsneX);
      })
      .attr("y", function(d) {
        return yScale(d.tsneY);
      })
      .attr("r", function(d) {
        if (d.pathogenic) {
          return 5;
        } else {
          return 4;
        }
      })
      .attr("cx", function(d) {
        return xScale(d.tsneX);
      })
      .attr("cy", function(d) {
        return yScale(d.tsneY);
      })
      .on("mouseover", function(d) {
        d3.select(this).style("cursor", "pointer");
        if (d.pathogenic) {
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " + d.control + "<br/>" + "Sample reads: " + d.sample + "<br/>" + "known pathogen");
        } else {
          return tooltip.style("visibility", "visible").html(d.name + "<br/>" + "Control reads: " + d.control + "<br/>" + "Sample reads: " + d.sample);
        }
      })
      .on("mousemove", function() { return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px"); })
      .on("mouseout", function() { d3.select(this).style("cursor", "default"); return tooltip.style("visibility", "hidden"); })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 2;
        } else {
          return 0.6;
        }
      })
      .style("stroke", '#000000')
      .style("fill", function(d) {
        return colorScale(d.clusters);
      });
      // .style("fill", function(d) {
      //     if (d['node_pos'] == 3) {
      //       return "#d3d3d3";
      //     } else if (d['node_pos'] == 2) {
      //       return "#5ac1e0";
      //     } else if (d['node_pos'] == 1) {
      //       return "#adadad";
      //     } else {
      //       return "#f4aa4e";
      //     }
      //   });
    circleEnter.merge(circle)
      .attr("x", function(d) {
        return xScale(d.tsneX);
      })
      .attr("y", function(d) {
        return yScale(d.tsneY);
      })
      .attr("r", function(d) {
        if (d["pathogenic"]) {
          return 5;
        } else {
          return 4;
        }
      })
      .attr("cx", function(d) {
        return xScale(d.tsneX);
      })
      .attr("cy", function(d) {
        return yScale(d.tsneY);
      })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 2;
        } else {
          return 0.6;
        }
      })
      .style("stroke", '#000000')
      .style("fill", function(d) {
        return colorScale(d.clusters);
      });
      // .style("fill", function(d) {
      //     if (d['node_pos'] == 3) {
      //       return "#d3d3d3";
      //     } else if (d['node_pos'] == 2) {
      //       return "#5ac1e0";
      //     } else if (d['node_pos'] == 1) {
      //       return "#adadad";
      //     } else {
      //       return "#f4aa4e";
      //     }
      //   });

    circle.exit()
      .remove();
  }

// plotting comparison of samples in a TSNE
  tsneSamplePlot(){
    let plotpoints = this.contaminantService.getPlotSamplePoints();

    let svg = d3.select(this.svg3.nativeElement)
      .attr("width", this.canvas_width)
      .attr("height", this.canvas_height);

    var tooltip = d3.select(this.tooltipEl.nativeElement);

    var clusterscale = d3.scaleLinear()
      .domain([d3.min(plotpoints, function(d) {
        return d.cluster;
      }), d3.max(plotpoints, function(d) {
        return d.cluster;
      })])
      .range([0, 1]);

    var colorScale = d3.scaleSequential((d)=>d3.interpolateRdYlBu(clusterscale(d)));

    var xScale = d3.scaleLinear()
      .domain([d3.min(plotpoints, function(d) {
        return d.tsneX-0.1;
      }), d3.max(plotpoints, function(d) {
        return d.tsneX+0.1;
      })])
      .range([this.padding, this.canvas_width - this.padding * 2])
      .nice();

    var yScale = d3.scaleLinear()
      .domain([d3.min(plotpoints, function(d) {
        return d.tsneY-0.1;
      }), d3.max(plotpoints, function(d) {
        return d.tsneY+0.1;
      })])
      .range([this.canvas_height - this.padding, this.padding])
      .nice();

    svg.selectAll(".dotlabel")
      .data(plotpoints)
      .enter()
      .append("text")
      .attr("class", "dotlabel")
      .attr("x", function(d) {
        return xScale(d.tsneX);
      })
      .attr("y", function(d) {
        return yScale(d.tsneY);
      })
      .attr("dx", ".71em")
      .attr("dy", ".35em")
      .text((d)=>d.name.replace(/MG-00/g, "").replace(/.report/g, ""));

    var circle = svg.selectAll(".taxon")
      .data(plotpoints);

    let circleEnter = circle.enter()
      .append("circle")
      .attr("class", "taxon")
      .attr("x", function(d) {
        return xScale(d.tsneX);
      })
      .attr("y", function(d) {
        return yScale(d.tsneY);
      })
      .attr("r", 4)
      .attr("cx", function(d) {
        return xScale(d.tsneX);
      })
      .attr("cy", function(d) {
        return yScale(d.tsneY);
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
        return xScale(d.tsneX);
      })
      .attr("y", function(d) {
        return yScale(d.tsneY);
      })
      .attr("r", 4)
      .attr("cx", function(d) {
        return xScale(d.tsneX);
      })
      .attr("cy", function(d) {
        return yScale(d.tsneY);
      })
      .attr("stroke-width", function(d) {
        if (d.pathogenic) {
          return 2;
        } else {
          return 0.6;
        }
      })
      .style("stroke", function(d) {
        // if (d.pathogenic) {
        //   return '#E04836';
        // } else {
          return '#000000';
        // }
      })
      .style("fill", function(d) {
        return colorScale(d.cluster);
          // if (d['node_pos'] == 3) {
          //   return "#d3d3d3";
          // } else if (d['node_pos'] == 2) {
          //   return "#5ac1e0";
          // } else if (d['node_pos'] == 1) {
          //   return "#adadad";
          // } else {
          //   return "#f4aa4e";
          // }
        });

    circle.exit()
      .remove();
  }
}
