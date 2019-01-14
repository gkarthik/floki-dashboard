import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef } from '@angular/core';

import { TaxonomyTreeService } from '../taxonomy-tree.service';

import { Taxon } from '../taxon';

import { HierarchyPointNode } from 'd3-hierarchy';
import { Selection } from 'd3-selection';
import { ScaleSequential } from 'd3-scale';

import * as d3 from 'd3';

@Component({
  selector: 'app-taxonomy-view',
  templateUrl: './taxonomy-view.component.html',
  styleUrls: ['./taxonomy-view.component.css']
})
export class TaxonomyViewComponent implements AfterViewInit {

  @ViewChild('wrapper') private canvas: ElementRef;

  private screenWidth;
  private screenHeight;

  // Styles
  private nodeSize: number = 5;
  private strokeWidth: number = 2;
  private colorScheme: { [element: string]: string } =  {
    "fill": "#4682b4",
    "hover_fill": "red",
    "stroke_style": "#000000",
    "text_fill": "#000000",
    "link_stroke_style": "#000000"
  };

  private scales: {[id: string]: [ScaleSequential<any>, ScaleSequential<any>]} = {
    "percentage": [null, null]
  };

  private canvasOffset: {[element: string]: number} = {
    "x": 50,
    "y": 0
  }
  
  private heatmap: {[element: string]: number} = {
    "square_size": 10
  }
  

  private cx: CanvasRenderingContext2D;
  private canvasEl: HTMLCanvasElement;

  private taxonomyTree: Taxon = new Taxon();
  private treeDescendants: HierarchyPointNode<Taxon>[];
  private pathToRoot: Taxon[] = [];
  private canvas_wrapper;

  constructor(
    private taxonomyTreeService: TaxonomyTreeService
  ) { }

  ngAfterViewInit(){
    this.getScreenSize();
    this.setUpCanvas();
    this.taxonomyTreeService.getTree().subscribe(_ => this.drawCanvas(1));
  }

  @HostListener('window:resize', ['$event'])
  getScreenSize(event?) {
    this.screenHeight = window.innerHeight;
    this.screenWidth = window.innerWidth;
  }

  drawCanvas(tax_id: number): void {
    let t: Taxon[] = this.taxonomyTreeService.setViewPort(tax_id);
    this.pathToRoot = t;
    this.taxonomyTree = t[t.length-1];
    this.treeDescendants = this.taxonomyTreeService.getLayout(this.taxonomyTree, this.screenHeight, this.screenWidth/2, this.canvasOffset.x, this.canvasOffset.y);
    console.log(this.taxonomyTree);
    this.canvas_wrapper = d3.select("#wrapper");
    this.update();
  }

  onCanvasClick(event): void {
    let _y = event.clientX - 15;
    let _x = event.clientY;
    let _this = this;
    d3.selectAll("custom-node")
      .each(function(d: HierarchyPointNode<Taxon>){
	if(_this.checkWithinRadius([d.y, d.x], [_y, _x], _this.nodeSize + _this.strokeWidth)){
	  console.log(d.data.tax_id);
	  _this.drawCanvas(d.data.tax_id);
	}
      })
  }

  onCanvasHover(event): void {
    let _y = event.clientX - 15;
    let _x = event.clientY;
    let _this = this;
    d3.selectAll("custom-node")
      .each(function(d: HierarchyPointNode<Taxon>){
	if(_this.checkWithinRadius([d.y, d.x], [_y, _x], _this.nodeSize + _this.strokeWidth)){
	  console.log(d.data.tax_id);
	  _this.drawCanvas(d.data.tax_id);
	}
      })
  }

  checkWithinRadius(p1: [number, number], p2: [number, number], r: number): boolean {
    let a = (p1[0] - p2[0])**2 + (p1[1] - p2[1])**2;
    a = Math.sqrt(a);
    return (a <= r);
  }

  drawHeatmap(nodeEl, d: HierarchyPointNode<Taxon>, key: string): void{
    var start_x = parseFloat(nodeEl.attr("x")) + this.heatmap.square_size,
    start_y = parseFloat(nodeEl.attr("y"));
    if(d.children !=null){
      start_x = parseFloat(nodeEl.attr("x")) - (this.heatmap.square_size * d.data[key].length)/2;
      start_y = start_y + 22;
    }
    for (var i = 0; i < d.data[key].length; i++) {
      this.cx.beginPath();
      this.cx.fillStyle = this.scales[key][d.depth-1](d.data[key][i]);
      this.cx.moveTo(start_x + (this.heatmap.square_size * i), start_y - (this.heatmap.square_size/2));
      this.cx.rect(start_x + (this.heatmap.square_size * i), start_y - (this.heatmap.square_size/2), this.heatmap.square_size, this.heatmap.square_size);
      this.cx.fill();
      this.cx.strokeStyle = "#000000";
      this.cx.stroke();
      this.cx.closePath();
    }
  }

  update(): void {
    let nodes = this.treeDescendants;
    let links: HierarchyPointNode<Taxon>[]  = this.treeDescendants.slice(1);

    let duration = 300;
    let node = this.canvas_wrapper.selectAll("custom-node").data(nodes);

    let node_enter = node.enter()
      .append("custom-node")
      .classed("node", true)
      .attr("x", function(d){
	return d.y;
      })
      .attr("y", function(d){
	return d.x;
      })
      .text(function(d){
	return d.data["taxon_name"];
      })
      .attr("size", this.nodeSize)
      .attr("fill", this.colorScheme.fill)
      .attr("stroke_style", this.colorScheme["stroke_style"])
      .attr("text_fill", this.colorScheme["text_fill"])
      .attr("line_width", this.strokeWidth);

    let node_update = node_enter.merge(node);

    node_update
      .attr("x", function(d){
	return d.y;
      })
      .attr("y", function(d){
	return d.x;
      })
      .text(function(d){
	return d.data["taxon_name"];
      });

    let node_exit = node.exit()
      .remove();

    let link = this.canvas_wrapper.selectAll("custom-link").data(links);

    let linkEnter = link.enter()
      .append("custom-link")
      .classed("link", true)
      .attr("sx", function(d){
    	return d.parent.y;
      })
      .attr("sy", function(d){
    	return d.parent.x;
      })
      .attr("tx", function(d){
    	return d.y;
      })
      .attr("ty", function(d){
    	return d.x;
      })
      .attr("line_width", this.strokeWidth)
      .attr("stroke_style", this.colorScheme["link_stroke_style"]);

    let linkUpdate = linkEnter.merge(link);

    linkUpdate
      .transition()
      .duration(duration)
      .attr("sx", function(d){
    	return d.parent.y;
      })
      .attr("sy", function(d){
    	return d.parent.x;
      })
      .attr("tx", function(d){
    	return d.y;
      })
      .attr("ty", function(d){
    	return d.x;
      });

    let linkExit = link.exit()
      .transition()
      .duration(duration)
      .attr("sx", function(d){
    	return d.parent.y;
      })
      .attr("sy", function(d){
    	return d.parent.x;
      })
      .attr("tx", function(d){
    	return d.parent.y;
      })
      .attr("ty", function(d){
    	return d.parent.x;
      })
      .remove();

    let m1: [number[], number[]] = this.taxonomyTreeService.getRangeOfKeyAtDepth(this.taxonomyTree, "percentage", this.taxonomyTree.depth + 1);
    let m2: [number[], number[]] = this.taxonomyTreeService.getRangeOfKeyAtDepth(this.taxonomyTree, "percentage", this.taxonomyTree.depth + 2);

    this.scales["percentage"][0] = d3.scaleSequential(d3.interpolateGreens)
      .domain([Math.min.apply(Math, m1[0]), Math.max.apply(Math, m1[1])]);
    this.scales["percentage"][1] = d3.scaleSequential(d3.interpolateBlues)
      .domain([Math.min.apply(Math, m2[0]), Math.max.apply(Math, m2[1])]);

    let _this = this;
    let t = d3.timer(function(elapsed) {
      _this.renderCanvas();
      if (elapsed > duration + (2 * duration)) t.stop();
    });
  }

  renderCanvas(): void {
    let _this = this;
    let tx: number, ty:number, sx: number, sy:number;
    _this.cx.clearRect(0, 0, this.screenWidth/2, this.screenHeight);
    this.canvas_wrapper.selectAll("custom-link").each(function(d){
      let _link: Selection<any, any, any, any> = d3.select(this);
      _this.cx.beginPath();
      sx = parseFloat(_link.attr("sx"));
      sy = parseFloat(_link.attr("sy"));
      tx = parseFloat(_link.attr("tx"));
      ty = parseFloat(_link.attr("ty"));
      _this.cx.moveTo(sx, sy);
      _this.cx.lineTo(0.5 * (tx + sx), sy);
      _this.cx.lineTo(0.5 * (tx + sx), ty);
      _this.cx.lineTo(tx, ty);
      _this.cx.strokeStyle = _link.attr("stroke-style");
      _this.cx.lineWidth = parseFloat(_link.attr("line-width"));
      _this.cx.stroke();
      _this.cx.closePath();
    });

    this.canvas_wrapper.selectAll("custom-node").each(function(d){
      let _node = d3.select(this), x: number, y:number;
      x = parseFloat(_node.attr("x"));
      y = parseFloat(_node.attr("y"));
      _this.cx.moveTo(x, y);
      _this.cx.beginPath();
      _this.cx.arc(x, y, parseFloat(_node.attr("size")), 0, 2 * Math.PI);
      _this.cx.fillStyle =  _node.attr("fill");
      _this.cx.fill();
      _this.cx.lineWidth = parseFloat(_node.attr("line-width"));
      _this.cx.strokeStyle = _node.attr("stroke-style");
      _this.cx.stroke();
      _this.cx.closePath();
      _this.cx.beginPath();
      _this.cx.font = "18px Open Sans";
      _this.cx.fillStyle = _node.attr("text-fill");
      if(d.children!=null){
	_this.cx.textAlign = "center";
	_this.cx.textBaseline = 'middle';
	_this.cx.fillText(_node.text(), x, y + parseFloat(_node.attr("size")) + 5);
      } else {
	_this.cx.textAlign = "left";
	_this.cx.textBaseline = 'middle';
	_this.cx.fillText(_node.text(), x + _this.heatmap.square_size * (d.data.percentage.length + 1) + parseFloat(_node.attr("size")), y);
      }
      _this.cx.fill();
      _this.cx.closePath();
      if(d.depth > 0){
	_this.drawHeatmap(_node, d, "percentage");
      }
    });
    // this.canvas_wrapper.selectAll("custom-node").each(function(d){
    //   var _node = d3.select(this);
    //   if(_node.attr("hover-status")=="active"){
    // 	draw_hover(d, ["percentage", "taxon_reads", "kmer_depth", "kmer_coverage"]);
    //   }
    // });
  }

  setUpCanvas(): void {
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    this.canvasEl = canvasEl;
    let dpr: number = window.devicePixelRatio || 1;
    let rect = canvasEl.getBoundingClientRect();
    canvasEl.width = (this.screenWidth/2) * dpr;
    canvasEl.height = (this.screenHeight) * dpr;
    canvasEl.style.width = String(this.screenWidth/2)+"px";
    canvasEl.style.height = String(this.screenHeight) + "px";

    this.cx = canvasEl.getContext('2d');
    this.cx.scale(dpr, dpr);
  }
}
