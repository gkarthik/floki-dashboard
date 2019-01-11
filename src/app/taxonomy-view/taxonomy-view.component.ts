import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef } from '@angular/core';

import { TaxonomyTreeService } from '../taxonomy-tree.service';
import { NodeComponent } from '../node/node.component';

import { Taxon } from '../taxon';

import { HierarchyPointNode } from 'd3-hierarchy'
import { Selection } from 'd3-selection'

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
  private heatmap: {[element: string]: number} = {
    "square_size": 10
  }
  

  private cx: CanvasRenderingContext2D;

  private taxonomyTree: Taxon = new Taxon();
  public treeDescendants: HierarchyPointNode<Taxon>[];
  private canvas_wrapper;

  constructor(
    private taxonomyTreeService: TaxonomyTreeService
  ) { }

  ngAfterViewInit(){
    this.getScreenSize();
    this.setUpCanvas();
    this.taxonomyTreeService.getTree().subscribe(_ => this.drawCanvas());
  }

  @HostListener('window:resize', ['$event'])
  getScreenSize(event?) {
    this.screenHeight = window.innerHeight;
    this.screenWidth = window.innerWidth;
    console.log(this.screenHeight, this.screenWidth);
  }

  drawCanvas(): void {
    let t: Taxon[] = this.taxonomyTreeService.setViewPort();
    this.taxonomyTree = t[t.length-1];
    this.treeDescendants = this.taxonomyTreeService.getLayout(this.taxonomyTree, this.screenHeight, this.screenWidth/2);
    this.canvas_wrapper = d3.select("#wrapper");
    this.update();
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

    let link = this.canvas_wrapper.selectAll("custom_link").data(links);

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

    linkUpdate.transition()
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
      .attr("sx", function(d: {parent: {y: number}}){
    	return d.parent.y;
      })
      .attr("sy", function(d: {parent: {x: number}}){
    	return d.parent.x;
      })
      .attr("tx", function(d: {parent: {y: number}}){
    	return d.parent.y;
      })
      .attr("ty", function(d: {parent: {x: number}}){
    	return d.parent.x;
      })
      .remove();

    // var m1 = get_range_at_depth(data, "percentage", data.depth + 1);
    // var m2 = get_range_at_depth(data, "percentage", data.depth + 2);

    // scales.percentage[0] = d3.scaleSequential(d3.interpolateGreens)
    //   .domain([Math.min.apply(Math, m1[0]), Math.max.apply(Math, m1[1])]);
    // scales.percentage[1] = d3.scaleSequential(d3.interpolateBlues)
    //   .domain([Math.min.apply(Math, m2[0]), Math.max.apply(Math, m2[1])]);
    var _ = this;
    // let t = d3.timer(function(elapsed) {
      _.renderCanvas();
    //   if (elapsed > duration + (0.3 * duration)) t.stop();
    // });
    
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
	// draw_heatmap(_node, d, "percentage");
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

    let dpr: number = window.devicePixelRatio || 1;
    let rect = canvasEl.getBoundingClientRect();
    canvasEl.width = (this.screenWidth/2) * dpr;
    canvasEl.height = (this.screenHeight) * dpr;

    this.cx = canvasEl.getContext('2d');
    this.cx.scale(dpr/2, dpr);
  }
}
