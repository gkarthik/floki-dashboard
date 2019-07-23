import { Component, OnInit, AfterViewInit, OnChanges, SimpleChange, SimpleChanges, HostListener, ViewChild, ElementRef, Input } from '@angular/core';

import { Taxon } from '../taxon';

import { ScaleLinear, ScaleBand } from 'd3-scale';

import * as d3 from 'd3';
import * as _ from "lodash";

@Component({
  selector: 'app-pass-threshold-table',
  templateUrl: './pass-threshold-table.component.html',
  styleUrls: ['./pass-threshold-table.component.css']
})
export class PassThresholdTableComponent implements OnChanges, AfterViewInit, OnInit {

  @ViewChild('tableWrapper') private svgEl: ElementRef;

  // private cx: CanvasRenderingContext2D;
  // private canvasEl: HTMLCanvasElement;

  @Input() nodeData: Taxon;
  @Input() key: string;
  @Input() screenHeight: number;
  @Input() screenWidth: number;

  // private keyTitle: string = "";

  private offset: { [id: string]: number } = {
    "x": 50,
    "y": 10
  };
  private padding = 20;

  private passFilterArray: string[][];
  private label: string[];

  constructor() { }

  ngOnInit() {
    // this.keyTitle = this.key.replace(/_/g, " ");
  }

  ngAfterViewInit() {
    // this.setUpCanvas();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!_.isEmpty(this.nodeData))
      this.drawChart();
  }

  drawChart(): void {
    let _data = this.nodeData;

    this.passFilterArray= [];
    this.passFilterArray[0]=[];
    this.label = [];
    //get the samples for which this taxa pass filters:
    for (var i = 0; i < _data.over_threshold.length; i++) {
      if(_data.over_threshold[i]==1){
        this.passFilterArray[0].push(_data.file[i].replace(/.report/g, '\u00A0'))
        // this.label.push('\u00A0');
      }
    }
    if(this.passFilterArray[0].length<1){
      this.label[0]="Does Not Pass Filters in Any Sample";
    }else{
      this.label[0] = "Passes Filters:";
    }
    // increase height if many samples pass threshold to make space
    if(this.passFilterArray[0].length>5){
      var _height: number = 70;
    }else if(this.passFilterArray[0].length>0) {
      var _height: number = 45;
    }else{
      var _height: number = 20;
    }
    let _width: number = this.screenWidth / 3 - (2 * this.offset.x);
    var _padding = this.padding;

    let svg = d3.select(this.svgEl.nativeElement)
      .attr("width", _width)
      .attr("height", _height);


    svg.select("foreignObject").remove();

    var table = svg.append("foreignObject")
      .attr("id", "#table")
      .attr("width", _width)
      .attr("height", _height)
      .append("xhtml:body");

      table.append("table");
      var header = table.append("thead").append("tr");
      header.selectAll("th")
            .data(this.label)
            .enter()
            .append("th")
            .text(function(d) { return d; });

    table.append("table");
    var tablebody = table.append("tbody");
    let rows = tablebody
            .selectAll("tr")
            .data(this.passFilterArray)
            .enter()
            .append("tr");
    // We built the rows using the nested array - now each row has its own array.
    let cells = rows.selectAll("td")
            .data(function(d) {
                return d;
            })
            .enter()
            .append("td")
            .text(function(d) {
                return d;
            });
  }

  setUpCanvas(): void {
    let _width: number = this.screenWidth / 3 - 30 - (2 * this.offset.x);
    let _height: number = 45;
    var _padding = this.padding;
    let _data = this.nodeData;

    let svg = d3.select(this.svgEl.nativeElement)
      .attr("width", _width)
      .attr("height", _height);
  }

}
