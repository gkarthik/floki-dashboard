import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import * as _ from "lodash";
import * as d3 from 'd3';

import { HierarchyPointNode } from 'd3-hierarchy'

import { Taxon } from './taxon';

@Injectable({
  providedIn: 'root'
})
export class TaxonomyTreeService {

  private reportUrl = "./assets/json-reports/test.json";
  private jsonData: Taxon = new Taxon();

  private rootReads: number[][];

  constructor(
    private http: HttpClient
  ) { }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      console.log(`${operation} failed: ${error.message}`);
      return of(result as T);
    };
  }

  getTree(): Observable<any> {
    return this.http.get<any>(this.reportUrl)
      .pipe(
        tap(d => this.jsonData = d),
        catchError(this.handleError('getTree', []))
      );
  }

  cutScores(d: Taxon, threshold: number) {
    this.cutScoresNode(d, threshold);
    this.sumTaxReads(d);
    this.rootReads = [d.taxon_reads,[d.ctrl_taxon_reads]];
    return d;
  }


  cutScoresNode(d: Taxon, threshold: number) {
    let ctrlscorearray = null;
    ctrlscorearray = d.ctrl_forward_score_distribution.split(",");
    for (let k = 0; k < 10; k++) {
      if (((k / 10) + 0.1) < threshold) {
        if (d.ctrl_reads - ctrlscorearray[k] <= 0 || isNaN(d.ctrl_reads - ctrlscorearray[k])) {
          d.ctrl_reads = 0;
        } else {
          d.ctrl_reads = d.ctrl_reads - ctrlscorearray[k]
        }
      }
    }
    for (let j = 0; j < d.file.length; j++) {
      let scorearray = null;
      scorearray = d.forward_score_distribution[j].split(",");
      for (let k = 0; k < 10; k++) {
        if (((k / 10) + 0.1) < threshold) {
          if (d.reads[j] - scorearray[k] < 0) {
            d.reads[j] = 0;
          } else {
            d.reads[j] = d.reads[j] - scorearray[k];
          }
        }
      }
    }
    if (d.children) {
      for (let i = 0; i < d.children.length; i++) {
        this.cutScoresNode(d.children[i], threshold);
      }
    }
  }

  sumTaxReads(d: Taxon): number[][] {
    let childreads: number[] = Array(d.file.length).fill(0);
    let child_ctrlreads: number = 0;
    if (d.children) {
      // childreads = childreads + d.children.forEach(this.sumTaxReads);
      for (let i = 0; i < d.children.length; i++) {
        let tmp = this.sumTaxReads(d.children[i])
        childreads = tmp[0].map(function(num, idx) {
          return num + childreads[idx];
        })
        child_ctrlreads = child_ctrlreads + tmp[1][0];
      }
    }
    for (let j = 0; j < d.file.length; j++) {
      if (isNaN(d.reads[j])) {
        d.taxon_reads[j] = childreads[j] + 0
      } else {
        d.taxon_reads[j] = d.reads[j] + childreads[j]
      }
    }
    if (isNaN(d.ctrl_taxon_reads)) {
      d.ctrl_taxon_reads = 0 + child_ctrlreads;
    } else {
      d.ctrl_taxon_reads = d.ctrl_reads + child_ctrlreads;
    }
    return [d.taxon_reads, d.ctrl_taxon_reads];
  }

  getLayout(data: Taxon, height: number, width: number, offsetX: number, offsetY: number, depth: number): HierarchyPointNode<Taxon>[] {
    let root = d3.hierarchy(data, function(d) { return d.children; });
    let tree_layout = d3.cluster<Taxon>().size([height - offsetX * 2, width - offsetY * 2]);
    let tree = tree_layout(root);
    let nodes = tree.descendants();
    nodes.forEach(function(d) {
      if (d.parent == null)
        d.y = offsetX;
      else if (d.data.tax_id == -1) // compressd nodes
        d.y = d.parent.y + 40;
      else
        d.y = d.parent.y + depth;
      d.x += offsetY;
    });
    return nodes;
  }

  // filterTreeRank(d: Taxon, minReads: number, sigLevel: number, minOddsRatio: number): boolean {
  //   let cond = [], keep_node: boolean = false, tmp, _this = this;
  //
  //   // Minimum number of reads
  //   keep_node = d.taxon_reads.some(function(x) {
  //     return x >= minReads;
  //   });
  //   cond.push(keep_node);
  //   // Maximum pvalue
  //   keep_node = d.pvalue.some(function(x) {
  //     return x <= sigLevel;
  //   });
  //   cond.push(keep_node);
  //   // Minimum odds ratio
  //   keep_node = d.oddsratio.some(function(x) {
  //     return x >= minOddsRatio;
  //   });
  //   cond.push(keep_node);
  //   keep_node = (d.rank != 'no rank');
  //   cond.push(keep_node);
  //   keep_node = cond.every(function(x) {
  //     return x;
  //   });
  //   cond = [keep_node];
  //   if (d.children != null) {
  //     for (var i = 0; i < d.children.length; i++) {
  //       tmp = this.filterTreeRank(d.children[i], minReads, sigLevel, minOddsRatio);
  //       cond.push(tmp);
  //       if (!tmp) {
  //         d.children.splice(i, 1);
  //         i--;
  //       }
  //     }
  //   }
  //   keep_node = cond.some(function(x) {
  //     return x;
  //   });
  //   return keep_node;
  // }

  getRootReads(): number[][] {
    return this.rootReads;
  }


  filterTaxonomyTree(d: Taxon, minReads: number, sigLevel: number, minOddsRatio: number): boolean {
    let cond = [], keep_node: boolean = false, tmp, _this = this;
    let rootReads = this.rootReads;
    d.ctrl_percentage = d.ctrl_taxon_reads/rootReads[1][0];
    d.percentage = d.taxon_reads.map(function(x,idx){
      if(isNaN(x/rootReads[0][idx])){
        return 0;
      }else{
        return x/rootReads[0][idx];
      }
    });
    // var a = [1,2,3,4]
    // var t = a.map(x=>x>5)
    // console.log(t)
    // console.log(t.some(x=>x))
    let thresholdarr = []
    // Minimum number of reads
    let t: boolean[] = d.taxon_reads.map(x => x >= minReads)
    cond.push(t.some(x => x))
    thresholdarr[0] = t;
    // Maximum pvalue
    t = d.pvalue.map(x => x <= sigLevel)
    cond.push(t.some(x => x))
    thresholdarr[1] = t;
    // Minimum odds ratio
    t = d.oddsratio.map(x => x >= minOddsRatio)
    cond.push(t.some(x => x))
    thresholdarr[2] = t;
    let overThreshold: number[] = [];
    for (i = 0; i < d.file.length; i++) {
      if ([thresholdarr[0][i], thresholdarr[1][i], thresholdarr[2][i]].every(x => x)) {
        overThreshold.push(1);
      } else {
        overThreshold.push(0);
      }
    }

    d.over_threshold = overThreshold;

    keep_node = cond.every(function(x) {
      return x;
    });
    cond = [keep_node];
    if (d.children != null) {
      for (var i = 0; i < d.children.length; i++) {
        tmp = this.filterTaxonomyTree(d.children[i], minReads, sigLevel, minOddsRatio);
        cond.push(tmp);
        if (!tmp) {
          d.children.splice(i, 1);
          i--;
        }
      }
    }
    keep_node = cond.some(function(x) {
      return x;
    });
    return keep_node;
  }

  filterBasedOnAnnotations(d: Taxon, key: string, minReads: number, sigLevel: number, minOddsRatio: number): boolean {
    let cond = [], keep_node: boolean = false, tmp, _this = this;
    let rootReads = this.rootReads;
    d.ctrl_percentage = d.ctrl_taxon_reads/rootReads[1][0];
    d.percentage = d.taxon_reads.map(function(x,idx){
      if(isNaN(x/rootReads[0][idx])){
        return 0;
      }else{
        return x/rootReads[0][idx];
      }
    });

    let thresholdarr = []
    //pathogenic
    keep_node = (d[key] == 1);
    cond.push(keep_node);

    // Minimum number of reads
    let t = d.taxon_reads.map(x => x >= minReads)
    cond.push(t.some(x => x))
    thresholdarr[0] = t;
    // Maximum pvalue
    t = d.pvalue.map(x => x <= sigLevel)
    cond.push(t.some(x => x))
    thresholdarr[1] = t;
    // Minimum odds ratio
    t = d.oddsratio.map(x => x >= minOddsRatio)
    cond.push(t.some(x => x))
    thresholdarr[2] = t;

    let overThreshold = [];
    for (i = 0; i < d.file.length; i++) {
      if ([thresholdarr[0][i], thresholdarr[1][i], thresholdarr[2][i]].every(x => x)) {
        overThreshold.push(1);
      } else {
        overThreshold.push(0);
      }
    }
    d.over_threshold = overThreshold;

    keep_node = cond.every(function(x) {
      return x;
    });
    cond = [keep_node];

    if (d.children != null) {
      for (var i = 0; i < d.children.length; i++) {
        tmp = this.filterBasedOnAnnotations(d.children[i], key, minReads, sigLevel, minOddsRatio);
        cond.push(tmp);
        if (!tmp) {
          d.children.splice(i, 1);
          i--;
        }
      }
    }
    keep_node = cond.some(function(x) {
      return x;
    });
    return keep_node;
  }

  // compressNodesRank(d: Taxon): void {
  //   if (d.rank != 'no rank' && d.depth>1) {
  //     while (d.children.some(function(x) { return (x.rank == 'no rank'); })) {
  //       for (var i = 0; i < d.children.length; i++) {
  //         if (d.children[i].rank == 'no rank') {
  //           if (d.children[i].children != null)
  //             d.children = d.children.concat(d.children[i].children);
  //           d.children.splice(i, 1);
  //           // d.num_nodes += 1;
  //           i--;
  //         }
  //       }
  //     }
  //   }
  //   for (var i = 0; i < d.children.length; i++) {
  //     this.compressNodesRank(d.children[i]);
  //   }
  // }

  compressNodesBasedOnAnnotation(d: Taxon, key: string): void {
    if (d[key] == 0 && d.depth > 1) {
      d.taxon_name = "Compressed";
      d.tax_id = -1;
      d.num_nodes = 1;
      while (!d.children.every(function(x) { return (x[key] == 1); })) {
        for (var i = 0; i < d.children.length; i++) {
          if (d.children[i][key] == 0) {
            if (d.children[i].children != null)
              d.children = d.children.concat(d.children[i].children);
            d.children.splice(i, 1);
            d.num_nodes += 1;
            i--;
          }
        }
      }
    }
    for (var i = 0; i < d.children.length; i++) {
      this.compressNodesBasedOnAnnotation(d.children[i], key);
    }
  }

  filterBasedOnSearch(d: Taxon, key: string, term: string, minReads: number, sigLevel: number, minOddsRatio: number): boolean {
    let cond = [], keep_node: boolean = false, tmp, _this = this;

    let rootReads = this.rootReads;

    d.ctrl_percentage = d.ctrl_taxon_reads/rootReads[1][0];
    d.percentage = d.taxon_reads.map(function(x,idx){
      if(isNaN(x/rootReads[0][idx])){
        return 0;
      }else{
        return x/rootReads[0][idx];
      }
    });
    // searching
    let termi: string[] = term.toString().split("or").map(x => x.toLowerCase().trim());
    // If some of the terms are included. Not all terms. For "or". This condition will change to .every() for "and"
    keep_node = termi.some(x => d[key].toLowerCase().includes(x));
    cond.push(keep_node);

    let thresholdarr = []
    // Minimum number of reads
    let t = d.taxon_reads.map(x => x >= minReads)
    cond.push(t.some(x => x))
    thresholdarr[0] = t;
    // Maximum pvalue
    t = d.pvalue.map(x => x <= sigLevel)
    cond.push(t.some(x => x))
    thresholdarr[1] = t;
    // Minimum odds ratio
    t = d.oddsratio.map(x => x >= minOddsRatio)
    cond.push(t.some(x => x))
    thresholdarr[2] = t;

    let overThreshold = []
    for (i = 0; i < d.file.length; i++) {
      if ([thresholdarr[0][i], thresholdarr[1][i], thresholdarr[2][i]].every(x => x)) {
        overThreshold.push(1);
      } else {
        overThreshold.push(0);
      }
    }
    d.over_threshold = overThreshold;

    keep_node = cond.every(function(x) {
      return x;
    });
    cond = [keep_node];

    if (d.children != null) {
      for (var i = 0; i < d.children.length; i++) {
        tmp = this.filterBasedOnSearch(d.children[i], key, term, minReads, sigLevel, minOddsRatio);
        cond.push(tmp);
        if (!tmp) {
          d.children.splice(i, 1);
          i--;
        }
      }
    }
    keep_node = cond.some(function(x) {
      return x;
    });
    return keep_node;
  }

  compressNodesBasedOnSearch(d: Taxon, key: string, term: string): void {
    let termi: string[] = term.toString().split("or").map(x => x.toLowerCase().trim());
    let flag: boolean = termi.some(x => d[key].toLowerCase().includes(x));
    if (!flag && d.depth > 1) {
      d.taxon_name = "Compressed";
      d.tax_id = -1;
      d.num_nodes = 1;
      // .some will change to .every() for "and" condition. .some() for "or" condition.
      while (!d.children.every(r => termi.some(x => r[key].toLowerCase().includes(x)))) {
        for (var y = 0; y < d.children.length; y++) {
          if (!termi.some(x => d.children[y][key].toLowerCase().includes(x))) {
            if (d.children[y].children != null) {
              d.children = d.children.concat(d.children[y].children);
            }
            d.children.splice(y, 1);
            d.num_nodes += 1;
            y--;
          }
        }
      }
    }
    for (var z = 0; z < d.children.length; z++) {
      this.compressNodesBasedOnSearch(d.children[z], key, term);
    }
  }

  // filterRanks(d: Taxon, minReads: number, sigLevel: number, minOddsRatio: number): Taxon {
  //   let data = _.cloneDeep(this.jsonData);
  //   this.filterTreeRank(data, minReads, sigLevel, minOddsRatio);
  //   this.compressNodesRank(data);
  //   return data;
  // }

  filterPathogenic(data: Taxon, minReads: number, sigLevel: number, minOddsRatio: number): Taxon {
    this.filterBasedOnAnnotations(data, "pathogenic", minReads, sigLevel, minOddsRatio);
    this.compressNodesBasedOnAnnotation(data, "pathogenic");
    return data;
  }

  filterSearch(data: Taxon, pathogenic: boolean, searchterm: string, minReads: number, sigLevel: number, minOddsRatio: number): Taxon {
    if (pathogenic) {
      this.filterBasedOnAnnotations(data, "pathogenic", minReads, sigLevel, minOddsRatio);
    }
    if (searchterm) {
      searchterm = searchterm.toLowerCase();
      this.filterBasedOnSearch(data, "taxon_name", searchterm, minReads, sigLevel, minOddsRatio);
      this.compressNodesBasedOnSearch(data, "taxon_name", searchterm);
    }
    return data;
  }

  setViewPort(data:Taxon, tax_id: number = 1): Taxon[] {
    // let data: Taxon = _.cloneDeep(this.jsonData);
    let path_to_root: Taxon[] = this.getPathToNode(data, tax_id);
    this.removeChildrenAtDepth(path_to_root[path_to_root.length - 1]);
    return path_to_root;
  }

  setBiggerPort(): Taxon {
    let data: Taxon = _.cloneDeep(this.jsonData);
    return data;
  }

  getRangeOfKeyAtDepth(_data: Taxon, key: string, depth: number, min?: number[], max?: number[]): [number[], number[]] {
    if (min == null || max == null) {
      min = Array(_data[key].length).fill(Infinity);
      max = Array(_data[key].length).fill(-1);
    }
    if (_data.depth == depth) {
      for (let i = 0; i < _data[key].length; i++) {
        min[i] = (_data[key][i] < min[i]) ? _data[key][i] : min[i];
        max[i] = (_data[key][i] > max[i]) ? _data[key][i] : max[i];
      }
    }
    var m;
    if (_data.children == null || _data.depth > depth) {
      return [min, max];
    }
    for (let i = 0; i < _data.children.length; i++) {
      m = this.getRangeOfKeyAtDepth(_data.children[i], key, depth, min, max);
      min = m[0];
      max = m[1];
    }
    return [min, max];
  }

  removeChildrenAtDepth(node: Taxon, depth: number = 2): boolean {
    if (depth == 0) {
      delete node.children;
      return true;
    }
    for (var i = 0; i < node.children.length; i++) {
      this.removeChildrenAtDepth(node.children[i], depth - 1);
    }
  }

  getPathToNode(node: Taxon, tax_id: number, path_root: Taxon[] = []): Taxon[] {
    if (node.tax_id == tax_id) {
      path_root.push(node);
      return path_root;
    }
    if (node.children != null) {
      let t: Taxon[];
      for (var i = 0; i < node.children.length; i++) {
        t = this.getPathToNode(node.children[i], tax_id, path_root);
        if (t.length != 0) {
          t.unshift(node);
          return t;
        }
      }
    }
    return path_root;
  }
}
