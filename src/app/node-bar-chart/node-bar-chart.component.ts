import { Component, OnInit, AfterViewInit, OnChanges, SimpleChange, SimpleChanges, HostListener, ViewChild, ElementRef, Input } from '@angular/core';

import { Taxon } from '../taxon';

import { ScaleLinear, ScaleBand } from 'd3-scale';

import * as d3 from 'd3';
import * as _ from "lodash";

@Component({
  selector: 'app-node-bar-chart',
  templateUrl: './node-bar-chart.component.html',
  styleUrls: ['./node-bar-chart.component.css']
})
export class NodeBarChartComponent implements OnChanges, AfterViewInit, OnInit {

  @ViewChild('chartWrapper') private canvas: ElementRef;

  private cx: CanvasRenderingContext2D;
  private canvasEl: HTMLCanvasElement;

  @Input() nodeData: Taxon;
  @Input() key: string;
  @Input() screenHeight: number;
  @Input() screenWidth: number;

  private keyTitle: string= "";

  private offset: {[id:string]: number} = {
    "x": 50,
    "y": 10
  };
  private padding = 20;

  constructor() { }

  ngOnInit(){
    this.keyTitle = this.key.replace(/_/g, " ");
  }

  ngAfterViewInit(){
    this.setUpCanvas();
  }

  ngOnChanges(changes: SimpleChanges){
    if(!_.isEmpty(this.nodeData))
      this.drawChart();
  }

  drawChart(): void {
    this.cx.clearRect(0, 0, this.screenWidth/3, this.screenHeight/4);

    let _width: number = this.screenWidth/3 - 30 - (2 * this.offset.x);
    let _height: number = this.screenHeight/4 - (2 * this.offset.y) - 50;
    var _padding = this.padding;
    let _data = this.nodeData;

    var x: ScaleBand<any> = d3.scaleBand()
      .rangeRound([0, _width])
      .padding(0.1);
    let y: ScaleLinear<number, number> = d3.scaleLinear()
      .rangeRound([0, _height]);
    x.domain(_data["file"]);
    let y_domain_elmns = _data[this.key].slice();
    y_domain_elmns.push(_data["ctrl_"+this.key]); // Get ctrl value as well
    y_domain_elmns.push(0);		    // Add zero
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
    this.cx.lineTo(this.offset.x + (x.padding() + x.bandwidth()) * (_data[this.key].length + 1), _height + this.offset.y);
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
      _this.cx.font="12px Open Sans";
      _this.cx.save();
      _this.cx.translate(_this.offset.x + x(d) + x.bandwidth() / 2 , _this.offset.y + _height + 6);
      _this.cx.rotate(-Math.PI/2);
      _this.cx.translate( -1 * (_this.offset.x + x(d) + x.bandwidth() / 2) , -1 * (_this.offset.y + _height + 6));
      _this.cx.textAlign = "right";
      _this.cx.textBaseline = "middle";
      _this.cx.fillText(d.split(".")[0], _this.offset.x + x(d) + x.bandwidth() / 2 , _this.offset.y + _height + 6);
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
      if(_this.key=="percentage"){
	_this.cx.fillText((d * 100).toExponential(1), _this.offset.x - 6, _this.offset.y + _height - y(d) + 0.5);
      } else {
	_this.cx.fillText(d.toExponential(1), _this.offset.x - 6, _this.offset.y + _height - y(d) + 0.5);
      }
      
    });
    this.cx.strokeStyle = "#000000";
    this.cx.stroke();

    for (var i = 0; i < _data[this.key].length; i++) {
      _this.cx.fillStyle = "steelblue";
      _this.cx.rect(_this.offset.x + x(_data["file"][i]), _this.offset.y + (_height - y(_data[_this.key][i])), x.bandwidth(), y(_data[_this.key][i]));
      _this.cx.fill();
    }
    this.cx.beginPath();
    this.cx.strokeStyle = "#FF0000";
    this.cx.moveTo(this.offset.x, this.offset.y + (_height - y(_data["ctrl_"+this.key])));
    this.cx.lineTo(this.offset.x + _width, this.offset.y + (_height - y(_data["ctrl_"+this.key])));
    this.cx.stroke();
  }

  setUpCanvas(): void {
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    this.canvasEl = canvasEl;
    let dpr: number = window.devicePixelRatio || 1;
    let rect = canvasEl.getBoundingClientRect();
    canvasEl.width = (this.screenWidth/2 - 30) * dpr;
    canvasEl.height = this.screenHeight/4 * dpr;
    canvasEl.style.width = String(this.screenWidth/2 - 30)+"px";
    canvasEl.style.height = String(this.screenHeight/4) + "px";
    this.cx = canvasEl.getContext('2d');
    this.cx.scale(dpr, dpr);
  }

}
