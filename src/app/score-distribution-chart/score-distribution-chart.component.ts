import { Component, OnInit, ViewChild, Input, ElementRef, OnChanges, AfterViewInit, SimpleChanges } from '@angular/core';

import { Taxon } from '../taxon';

import { ScaleLinear, ScaleBand, ScaleOrdinal } from 'd3-scale';
import { Color } from 'd3-color';

import * as d3 from 'd3';
import * as _ from "lodash";

@Component({
  selector: 'app-score-distribution-chart',
  templateUrl: './score-distribution-chart.component.html',
  styleUrls: ['./score-distribution-chart.component.css']
})
export class ScoreDistributionChartComponent implements OnChanges, AfterViewInit, OnInit {

  @ViewChild('chartWrapper') private canvas: ElementRef;

  private cx: CanvasRenderingContext2D;
  private canvasEl: HTMLCanvasElement;

  private ctrl_distribution: number[] = [];
  private distribution: number[][] = [];
  private bins: number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  private keyTitle: string = "";


  private offset: { [id: string]: number } = {
    "x": 50,
    "y": 10
  };
  private padding = 20;


  @Input() nodeData: Taxon;
  @Input() key: string;
  @Input() screenHeight: number;
  @Input() screenWidth: number;

  constructor() { }

  ngAfterViewInit() {
    this.setUpCanvas();
  }

  ngOnInit() {
    this.keyTitle = this.key.replace(/_/g, " ");
  }


  ngOnChanges(changes: SimpleChanges) {
    if (!_.isEmpty(this.nodeData)) {
      console.log(this.nodeData[this.key]);
      this.distribution = [];
      if (this.nodeData["ctr_l" + this.key] != "")
        this.ctrl_distribution = this.nodeData["ctrl_" + this.key].split(",").map(x => parseInt(x))
      for (var i = 0; i < this.nodeData[this.key].length; i++) {
        if (this.nodeData[this.key][i] != "")
          this.distribution.push(this.nodeData[this.key][i].split(",").map(x => parseInt(x)));
      }
      this.drawChart();
    }
  }

  drawChart(): void {
    this.cx.clearRect(0, 0, this.screenWidth / 3, this.screenHeight / 4);

    let _width: number = this.screenWidth / 3 - 30 - (2 * this.offset.x);
    let _height: number = this.screenHeight / 4 - (2 * this.offset.y) - 50;
    var _padding = this.padding;
    let _data = this.nodeData;

    var x: ScaleBand<any> = d3.scaleBand()
      .rangeRound([0, _width])
      .padding(0.1);
    let y: ScaleLinear<number, number> = d3.scaleLinear()
      .rangeRound([0, _height]);
    x.domain(this.bins);
    let y_domain_elmns = [].concat.apply([], this.distribution);
    y_domain_elmns.push.apply(y_domain_elmns, this.ctrl_distribution); // Get ctrl value as well
    y_domain_elmns.push(0); // Add zero
    let y_domain = [Math.min.apply(Math, y_domain_elmns), Math.max.apply(Math, y_domain_elmns)];
    if (y_domain[0] == y_domain[1]) {
      y_domain[0] = y_domain[1] - 0.5; // If value 0 show zero.
    }
    y.domain(y_domain);


    // x and y axis
    this.cx.beginPath();
    this.cx.lineWidth = 2;
    this.cx.strokeStyle = "#000000";
    this.cx.moveTo(this.offset.x, _height + this.offset.y);
    this.cx.lineTo(this.offset.x + (x.padding() + x.bandwidth()) * (this.bins.length + 1), _height + this.offset.y);
    this.cx.moveTo(this.offset.x, this.offset.y);
    this.cx.lineTo(this.offset.x, this.offset.y + _height + 1);
    this.cx.stroke();
    this.cx.closePath();

    // x ticks
    this.cx.beginPath();
    this.cx.fillStyle = "#000000";
    this.cx.strokeStyle = "#000000";
    let _this = this;
    x.domain().forEach(function(d) {
      _this.cx.moveTo(_this.offset.x + x(d) + x.bandwidth() / 2, _this.offset.y + _height);
      _this.cx.lineTo(_this.offset.x + x(d) + x.bandwidth() / 2, _this.offset.y + _height + 6);
      _this.cx.font = "12px Open Sans";
      _this.cx.save();
      _this.cx.translate(_this.offset.x + x(d) + x.bandwidth() / 2, _this.offset.y + _height + 6);
      _this.cx.rotate(-Math.PI / 2);
      _this.cx.translate(-1 * (_this.offset.x + x(d) + x.bandwidth() / 2), -1 * (_this.offset.y + _height + 6));
      _this.cx.textAlign = "right";
      _this.cx.textBaseline = "middle";
      _this.cx.fillText(d, _this.offset.x + x(d) + x.bandwidth() / 2, _this.offset.y + _height + 6);
      _this.cx.restore();
    });
    _this.cx.strokeStyle = "#000000";
    _this.cx.stroke();


    // y ticks
    y.ticks(10).forEach(function(d) {
      _this.cx.moveTo(_this.offset.x, _this.offset.y + _height - y(d) + 0.5);
      _this.cx.lineTo(_this.offset.x - 6, _this.offset.y + _height - y(d) + 0.5);
      _this.cx.textAlign = "right";
      _this.cx.textBaseline = "middle";
      if (_this.key == "percentage") {
        _this.cx.fillText((d * 100).toExponential(1), _this.offset.x - 6, _this.offset.y + _height - y(d) + 0.5);
      } else {
        _this.cx.fillText(d.toExponential(1), _this.offset.x - 6, _this.offset.y + _height - y(d) + 0.5);
      }
    });
    this.cx.strokeStyle = "#000000";
    this.cx.stroke();

    let sampleColor = d3.scaleOrdinal(d3.schemeCategory10).domain(_data["file"]);
    let c;

    for (var i = 0; i < this.distribution.length; i++) {
      c = d3.color(sampleColor(_data["file"][i]));
      c.opacity = 0.01;
      for (var j = 0; j < this.distribution[i].length; j++) {
        _this.cx.fillStyle = c + "";
        _this.cx.rect(_this.offset.x + x(j * 0.1) + x.bandwidth() / 2, _this.offset.y + (_height - y(this.distribution[i][j])), x.bandwidth(), y(this.distribution[i][j]));
        _this.cx.fill();
      }
    }
    this.cx.closePath();

    this.cx.beginPath();

    for (var j = 0; j < this.ctrl_distribution.length; j++) {
      _this.cx.moveTo(_this.offset.x + x(j * 0.1) + x.bandwidth() / 2, _this.offset.y + (_height - y(this.ctrl_distribution[j])));
      _this.cx.lineTo(_this.offset.x + x(j * 0.1) + x.bandwidth() / 2 + (x.bandwidth()), _this.offset.y + (_height - y(this.ctrl_distribution[j])));
    }
    _this.cx.strokeStyle = "rgba(205, 92, 92, 1)";
    _this.cx.stroke();
    _this.cx.closePath();

    _this.cx.strokeStyle = "#000000";

  }

  setUpCanvas(): void {
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    this.canvasEl = canvasEl;
    let dpr: number = window.devicePixelRatio || 1;
    let rect = canvasEl.getBoundingClientRect();
    canvasEl.width = (this.screenWidth / 2 - 30) * dpr;
    canvasEl.height = this.screenHeight / 4 * dpr;
    canvasEl.style.width = String(this.screenWidth / 2 - 30) + "px";
    canvasEl.style.height = String(this.screenHeight / 4) + "px";
    this.cx = canvasEl.getContext('2d');
    this.cx.scale(dpr, dpr);
  }

}
