import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef, Input } from '@angular/core';
import { NodeBarChartComponent } from '../node-bar-chart/node-bar-chart.component';

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
export class TaxonomyViewComponent implements AfterViewInit, OnInit {

  @ViewChild('wrapper') private canvas: ElementRef;

  private screenWidth = 100;
  private screenHeight = 100;

  private minReads: number = 10;
  private sigLevel: number = 0.05;
  private minOddsRatio: number = 1;

  private searchterm: string;
  private pathogenic: boolean = false;

  // Styles
  private nodeSize: number = 5;
  private strokeWidth: number = 2;
  private colorScheme: { [element: string]: string } = {
    "fill": "#4682b4",
    "hover_fill": "#86C67C",
    "compressed_fill": "#FF0000",
    "compressed_text_fill": "#FFFFFF",
    "stroke_style": "#000000",
    "text_fill": "#000000",
    "link_stroke_style": "#000000"
  };

  private scales: { [id: string]: [ScaleSequential<any>, ScaleSequential<any>] } = {
    "percentage": [null, null]
  };

  private canvasOffset: { [element: string]: number } = {
    "x": 50,
    "y": 0
  }

  private heatmap: { [element: string]: number } = {
    "square_size": 10
  }


  private cx: CanvasRenderingContext2D;
  private canvasEl: HTMLCanvasElement;

  private taxonomyTree: Taxon = new Taxon();
  private currentNode: Taxon = new Taxon();
  private treeDescendants: HierarchyPointNode<Taxon>[];
  private pathToRoot: Taxon[] = [];
  private canvasWrapper;

  constructor(
    private taxonomyTreeService: TaxonomyTreeService
  ) { }

  ngOnInit() {
    this.getScreenSize(); // On init since value passed to node-bar-chart component
  }

  ngAfterViewInit() {
    this.setUpCanvas();
    this.canvasWrapper = d3.select("#wrapper");
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
    this.taxonomyTree = t[t.length - 1];
    this.taxonomyTreeService.filterTaxonomyTree(this.taxonomyTree, this.minReads, this.sigLevel, this.minOddsRatio);
    this.currentNode = this.taxonomyTree;
    this.treeDescendants = this.taxonomyTreeService.getLayout(this.taxonomyTree, this.screenHeight, this.screenWidth * (2 / 3), this.canvasOffset.x, this.canvasOffset.y, this.screenWidth * (1 / 6));
    this.update();
  }

  showSearch(): void {
    this.taxonomyTree = this.taxonomyTreeService.filterSearch(this.pathogenic, this.searchterm, this.minReads, this.sigLevel, this.minOddsRatio);
    // this.taxonomyTreeService.filterTaxonomyTree(this.taxonomyTree, this.minReads, this.sigLevel, this.minOddsRatio);
    this.pathToRoot = [this.taxonomyTree];
    this.currentNode = this.taxonomyTree;
    this.treeDescendants = this.taxonomyTreeService.getLayout(this.taxonomyTree, this.screenHeight, this.screenWidth * (2 / 3), this.canvasOffset.x, this.canvasOffset.y, this.screenWidth * (1 / 12));
    this.update();
  }

  showPathogenic(tax_id: number): void {
    this.taxonomyTree = this.taxonomyTreeService.filterTree(this.taxonomyTree, this.minReads, this.sigLevel, this.minOddsRatio);
    // this.taxonomyTree = this.taxonomyTreeService.filterPathogenic(this.minReads, this.sigLevel, this.minOddsRatio);
    // this.taxonomyTreeService.filterTaxonomyTree(this.taxonomyTree, this.minReads, this.sigLevel, this.minOddsRatio);
    this.pathToRoot = [this.taxonomyTree];
    this.currentNode = this.taxonomyTree;
    this.treeDescendants = this.taxonomyTreeService.getLayout(this.taxonomyTree, this.screenHeight, this.screenWidth * (2 / 3), this.canvasOffset.x, this.canvasOffset.y, this.screenWidth * (1 / 12));
    this.update();
  }

  onCanvasClick(event): void {
    let _y = event.clientX - this.canvasEl.getBoundingClientRect()["x"];
    let _x = event.clientY - this.canvasEl.getBoundingClientRect()["y"];
    let _this = this;
    d3.selectAll("custom-node")
      .each(function(d: HierarchyPointNode<Taxon>) {
        if (_this.checkWithinRadius([d.y, d.x], [_y, _x], _this.nodeSize + _this.strokeWidth)) {
          if (d.data.tax_id != -1) // Avoid compressed nodes
            _this.drawCanvas(d.data.tax_id);
        }
      })
  }

  onCanvasHover(event): void {
    let _y = event.clientX - this.canvasEl.getBoundingClientRect()["x"];
    let _x = event.clientY - this.canvasEl.getBoundingClientRect()["y"];
    let _this = this;
    let hoverEvent: boolean = false;
    d3.selectAll("custom-node")
      .each(function(d: HierarchyPointNode<Taxon>) {
        if (_this.checkWithinRadius([d.y, d.x], [_y, _x], _this.nodeSize + _this.strokeWidth)) {
          if (d3.select(this).attr("_fill") == null)
            d3.select(this).attr("_fill", String(d3.select(this).attr("fill")));
          d3.select(this).attr("fill", _this.colorScheme["hover_fill"]);
          if (d.data.tax_id != -1) // Avoid hover oncompressed nodes
            _this.currentNode = d.data;
          _this.canvasEl.style.cursor = "pointer";
          hoverEvent = true;
        } else if (d3.select(this).attr("_fill") != null) {
          d3.select(this).attr("fill", d3.select(this).attr("_fill"));
        }
      });
    if (!hoverEvent)
      this.canvasEl.style.cursor = "auto";
    this.renderCanvas();
  }

  checkWithinRadius(p1: [number, number], p2: [number, number], r: number): boolean {
    let a = (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2;
    a = Math.sqrt(a);
    return (a <= r);
  }

  drawHeatmap(nodeEl, d: HierarchyPointNode<Taxon>, key: string): void {
    var start_x = parseFloat(nodeEl.attr("x")) + this.heatmap.square_size,
      start_y = parseFloat(nodeEl.attr("y"));
    if (d.children != null) {
      start_x = parseFloat(nodeEl.attr("x")) - (this.heatmap.square_size * d.data[key].length) / 2;
      start_y = start_y + 22;
    }
    for (var i = 0; i < d.data[key].length; i++) {
      if (d.children == null) {
        this.cx.fillStyle = this.scales[key][1](d.data[key][i]);
      } else if (d.children.every(function(x) { return (x.children == null); })) {
        this.cx.fillStyle = this.scales[key][0](d.data[key][i]);
      } else {
        continue;
      }
      this.cx.beginPath();
      this.cx.moveTo(start_x + (this.heatmap.square_size * i), start_y - (this.heatmap.square_size / 2));
      this.cx.rect(start_x + (this.heatmap.square_size * i), start_y - (this.heatmap.square_size / 2), this.heatmap.square_size, this.heatmap.square_size);
      this.cx.fill();
      this.cx.strokeStyle = "#000000";
      this.cx.stroke();
      this.cx.closePath();
    }
  }

  update(): void {
    let _this = this;
    let nodes = this.treeDescendants;
    let links: HierarchyPointNode<Taxon>[] = this.treeDescendants.slice(1);

    let duration = 300;
    let node = this.canvasWrapper.selectAll("custom-node").data(nodes);

    let node_enter = node.enter()
      .append("custom-node")
      .classed("node", true)
      .attr("x", function(d) {
        return d.y;
      })
      .attr("y", function(d) {
        return d.x;
      })
      .text(function(d) {
        if (d.data.tax_id == -1)
          return String(d.data.num_nodes);
        return d.data["taxon_name"];
      })
      .attr("size", function(d) {
        if (d.data.tax_id == -1)
          return _this.nodeSize * 2.5;
        return _this.nodeSize;
      })
      .attr("fill", function(d) {
        if (d.data.tax_id == -1)
          return _this.colorScheme["compressed_fill"];
        return _this.colorScheme.fill;
      })
      .attr("text_fill", function(d) {
        if (d.data.tax_id == -1)
          return _this.colorScheme["compressed_text_fill"];
        return _this.colorScheme.fill;
      })
      .attr("stroke_style", this.colorScheme["stroke_style"])
      .attr("text_fill", this.colorScheme["text_fill"])
      .attr("line_width", this.strokeWidth)
      .attr("_fill", null);

    let node_update = node_enter.merge(node);

    node_update
      .attr("x", function(d) {
        return d.y;
      })
      .attr("y", function(d) {
        return d.x;
      })
      .text(function(d) {
        if (d.data.tax_id == -1)
          return String(d.data.num_nodes)
        return d.data["taxon_name"];
      })
      .attr("text_fill", function(d) {
        if (d.data.tax_id == -1)
          return _this.colorScheme["compressed_text_fill"];
        return _this.colorScheme.fill;
      })
      .attr("size", function(d) {
        if (d.data.tax_id == -1)
          return _this.nodeSize * 2;
        return _this.nodeSize;
      })
      .attr("fill", function(d) {
        if (d.data.tax_id == -1)
          return _this.colorScheme["compressed_fill"];
        return _this.colorScheme.fill;
      })
      .attr("_fill", null);

    let node_exit = node.exit()
      .remove();

    let link = this.canvasWrapper.selectAll("custom-link").data(links);

    let linkEnter = link.enter()
      .append("custom-link")
      .classed("link", true)
      .attr("sx", function(d) {
        return d.parent.y;
      })
      .attr("sy", function(d) {
        return d.parent.x;
      })
      .attr("tx", function(d) {
        return d.y;
      })
      .attr("ty", function(d) {
        return d.x;
      })
      .attr("line_width", this.strokeWidth)
      .attr("stroke_style", this.colorScheme["link_stroke_style"]);

    let linkUpdate = linkEnter.merge(link);

    linkUpdate
      .transition()
      .duration(duration)
      .attr("sx", function(d) {
        return d.parent.y;
      })
      .attr("sy", function(d) {
        return d.parent.x;
      })
      .attr("tx", function(d) {
        return d.y;
      })
      .attr("ty", function(d) {
        return d.x;
      });

    let linkExit = link.exit()
      .transition()
      .duration(duration)
      .attr("sx", function(d) {
        return d.parent.y;
      })
      .attr("sy", function(d) {
        return d.parent.x;
      })
      .attr("tx", function(d) {
        return d.parent.y;
      })
      .attr("ty", function(d) {
        return d.parent.x;
      })
      .remove();

    let m1: [number[], number[]] = this.taxonomyTreeService.getRangeOfKeyAtDepth(this.taxonomyTree, "percentage", this.taxonomyTree.depth + 1);
    let m2: [number[], number[]] = this.taxonomyTreeService.getRangeOfKeyAtDepth(this.taxonomyTree, "percentage", this.taxonomyTree.depth + 2);

    this.scales["percentage"][0] = d3.scaleSequential(d3.interpolateGreens)
      .domain([Math.min.apply(Math, m1[0]), Math.max.apply(Math, m1[1])]);
    this.scales["percentage"][1] = d3.scaleSequential(d3.interpolateBlues)
      .domain([Math.min.apply(Math, m2[0]), Math.max.apply(Math, m2[1])]);

    let t = d3.timer(function(elapsed) {
      _this.renderCanvas();
      if (elapsed > duration + (2 * duration)) t.stop();
    });
  }

  renderCanvas(): void {
    let _this = this;
    let tx: number, ty: number, sx: number, sy: number;
    this.cx.clearRect(0, 0, this.screenWidth * (2 / 3), this.screenHeight);
    this.canvasWrapper.selectAll("custom-link").each(function(d) {
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

    this.canvasWrapper.selectAll("custom-node").each(function(d) {
      let _node = d3.select(this), x: number, y: number;
      x = parseFloat(_node.attr("x"));
      y = parseFloat(_node.attr("y"));
      _this.cx.moveTo(x, y);
      _this.cx.beginPath();
      _this.cx.arc(x, y, parseFloat(_node.attr("size")), 0, 2 * Math.PI);
      _this.cx.fillStyle = _node.attr("fill");
      _this.cx.lineWidth = parseFloat(_node.attr("line-width"));
      _this.cx.strokeStyle = _node.attr("stroke-style");
      _this.cx.fill();
      _this.cx.stroke();
      _this.cx.closePath();
      _this.cx.beginPath();
      _this.cx.font = "18px 'Lato', sans-serif";
      _this.cx.fillStyle = _node.attr("text_fill");
      if (d.data.tax_id == -1) {
        _this.cx.textAlign = "center";
        _this.cx.textBaseline = 'middle';
        _this.cx.fillText(_node.text(), x, y);
      } else if (d.children != null) {
        _this.cx.textAlign = "center";
        _this.cx.textBaseline = 'middle';
        _this.cx.fillText(_node.text(), x, y - parseFloat(_node.attr("size")) * 2 - 5);
      } else {
        _this.cx.textAlign = "left";
        _this.cx.textBaseline = 'middle';
        _this.cx.fillText(_node.text(), x + _this.heatmap.square_size * (d.data.percentage.length + 1) + parseFloat(_node.attr("size")), y);
      }
      _this.cx.fill();
      _this.cx.closePath();
      if (d.depth > 0 && d.data.tax_id != -1) {
        _this.drawHeatmap(_node, d, "percentage");
      }
    });
    // this.canvasWrapper.selectAll("custom-node").each(function(d){
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
    canvasEl.width = (this.screenWidth * (2 / 3) - 30) * dpr;
    canvasEl.height = this.screenHeight * dpr;
    // canvasEl.style.width = String(this.screenWidth / 2 - 30) + "px";
    canvasEl.style.height = String(this.screenHeight) + "px";
    this.cx = canvasEl.getContext('2d');
    this.cx.scale(dpr, dpr);
  }
}
