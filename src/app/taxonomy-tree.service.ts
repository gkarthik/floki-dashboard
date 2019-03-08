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

  filterTaxonomyTree(d: Taxon, minReads: number, sigLevel: number, minOddsRatio: number): boolean {
    let cond = [], keep_node: boolean = false, tmp, _this = this;
    // Minimum number of reads
    keep_node = d.taxon_reads.some(function(x) {
      return x >= minReads;
    });
    cond.push(keep_node);
    // Maximum pvalue
    keep_node = d.pvalue.some(function(x) {
      return x <= sigLevel;
    });
    cond.push(keep_node);
    // Minimum odds ratio
    keep_node = d.oddsratio.some(function(x) {
      return x >= minOddsRatio;
    });
    cond.push(keep_node);
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
    // Minimum number of reads
    keep_node = d.taxon_reads.some(function(x) {
      return x >= minReads;
    });
    cond.push(keep_node);
    // Maximum pvalue
    keep_node = d.pvalue.some(function(x) {
      return x <= sigLevel;
    });
    cond.push(keep_node);
    // Minimum odds ratio
    keep_node = d.oddsratio.some(function(x) {
      return x >= minOddsRatio;
    });
    cond.push(keep_node);
    keep_node = (d[key] == 1);
    cond.push(keep_node);
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
    // Minimum number of reads
    keep_node = d.taxon_reads.some(function(x) {
      return x >= minReads;
    });
    cond.push(keep_node);
    // Maximum pvalue
    keep_node = d.pvalue.some(function(x) {
      return x <= sigLevel;
    });
    cond.push(keep_node);
    // Minimum odds ratio
    keep_node = d.oddsratio.some(function(x) {
      return x >= minOddsRatio;
    });
    cond.push(keep_node);
    keep_node = d[key].toLowerCase().includes(term);
    cond.push(keep_node);
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
    if (!d[key].toLowerCase().includes(term) && d.depth > 1) {
      d.taxon_name = "Compressed";
      d.tax_id = -1;
      d.num_nodes = 1;
      console.log(d.children.length);
      while (!d.children.every(function(x) { return x[key].toLowerCase().includes(term); })) {
        for (var i = 0; i < d.children.length; i++) {
          if (!d.children[i][key].toLowerCase().includes(term)) {
            if (d.children[i].children != null) {
              d.children = d.children.concat(d.children[i].children);
            }
            d.children.splice(i, 1);
            d.num_nodes += 1;
            i--;
          }
        }
      }
    }
    for (var i = 0; i < d.children.length; i++) {
      this.compressNodesBasedOnSearch(d.children[i], key, term);
    }
  }

  filterPathogenic(minReads: number, sigLevel: number, minOddsRatio: number): Taxon {
    let data = _.cloneDeep(this.jsonData);
    this.filterBasedOnAnnotations(data, "pathogenic", minReads, sigLevel, minOddsRatio);
    this.compressNodesBasedOnAnnotation(data, "pathogenic");
    return data;
  }

  filterSearch(pathogenic: boolean, searchterm: string, minReads: number, sigLevel: number, minOddsRatio: number): Taxon {
    let data = _.cloneDeep(this.jsonData);
    if (pathogenic) {
      this.filterBasedOnAnnotations(data, "pathogenic", minReads, sigLevel, minOddsRatio);
    }
    if (searchterm) {
      if (searchterm.length > 3) {
        searchterm = searchterm.toLowerCase();
        this.filterBasedOnSearch(data, "taxon_name", searchterm, minReads, sigLevel, minOddsRatio);
        this.compressNodesBasedOnSearch(data, "taxon_name", searchterm);
      }
    }
    return data;
  }

  setViewPort(tax_id: number = 1): Taxon[] {
    let data: Taxon = _.cloneDeep(this.jsonData);
    let path_to_root: Taxon[] = this.getPathToNode(data, tax_id);
    this.removeChildrenAtDepth(path_to_root[path_to_root.length - 1]);
    return path_to_root;
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
