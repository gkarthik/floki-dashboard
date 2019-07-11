import { Component, OnInit, AfterViewInit, OnChanges, SimpleChange, SimpleChanges, HostListener, ViewChild, ElementRef, Input } from '@angular/core';

import { Taxon } from '../taxon';

import { ScaleLinear, ScaleBand } from 'd3-scale';

import * as d3 from 'd3';
import * as _ from "lodash";

@Component({
  selector: 'app-node-pathogenic-table',
  templateUrl: './node-pathogenic-table.component.html',
  styleUrls: ['./node-pathogenic-table.component.css']
})
export class NodePathogenicTableComponent implements OnChanges, AfterViewInit, OnInit {

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

  private diseaseArray: string[][];
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

    let _width: number = this.screenWidth / 3 - (2 * this.offset.x);
    let _height: number = this.screenHeight / 4 - (2 * this.offset.y) - 50;
    var _padding = this.padding;
    let _data = this.nodeData;

    let svg = d3.select(this.svgEl.nativeElement)
      .attr("width", _width)
      .attr("height", _height);

    this.diseaseArray= [];
    this.label = [];
    // let diseases;
    if(_data.pathogenic ==1){
      this.label = ["Disease",'\xA0'+ "Symptoms"];
      for (var i = 0; i < _data.diseases.length; i++) {
        let symptoms = []
        for (var j = 0; j < _data.diseases[i]['symptoms'].length; j++){
           symptoms.push(_data.diseases[i]['symptoms'][j]['label'])
        }
        this.diseaseArray[i]=[_data.diseases[i]['label'],'\xA0'+symptoms]
      }
    }else{
      this.label = ["Not marked pathogenic"];
      this.diseaseArray = [['\xA0']]
    }

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
    var tablebody = table.append("tbody");
    let rows = tablebody
            .selectAll("tr")
            .data(this.diseaseArray)
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
    let _height: number = this.screenHeight / 4 - (2 * this.offset.y) - 50;
    var _padding = this.padding;
    let _data = this.nodeData;

    let svg = d3.select(this.svgEl.nativeElement)
      .attr("width", _width)
      .attr("height", _height);
  }

}
