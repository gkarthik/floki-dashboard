import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import * as _ from "lodash";
import * as d3 from 'd3';

import { HierarchyPointNode } from 'd3-hierarchy'

import { Taxon } from './taxon';
import { Node } from './node';
import { Link } from './link';

@Injectable({
  providedIn: 'root'
})
export class TaxonomyTreeService {

  private reportUrl = "./assets/json-reports/test.json";
  private jsonData: Taxon = new Taxon();

  constructor(
    private http: HttpClient
  ) { }

  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      console.log(`${operation} failed: ${error.message}`);
      return of(result as T);
    };
  }
  
  getTree(): Observable<any> {
    return this.http.get<any>(this.reportUrl)
      .pipe(
	tap(_ => this.jsonData = _),
	catchError(this.handleError('getTree', []))
      );
  }

  getLayout(data: Taxon, height:number, width: number, offsetX: number, offsetY: number): HierarchyPointNode<Taxon>[] {
    let root = d3.hierarchy(data, function(d){return d.children;});
    let tree_layout = d3.cluster<Taxon>().size([height-offsetX*2, width-offsetY*2]);
    let tree = tree_layout(root);
    let nodes = tree.descendants();
    nodes.forEach(function(d){
      d.y = (d.depth * width/3) + offsetX;
      d.x += offsetY;
    });
    return nodes;
  }

  setViewPort(tax_id: number = 1): Taxon[] {
    let data: Taxon = _.cloneDeep(this.jsonData);
    let path_to_root: Taxon[] = this.getPathToNode(data, tax_id);
    this.removeChildrenAtDepth(path_to_root[path_to_root.length-1]);
    return path_to_root;
  }

  getRangeOfKeyAtDepth(_data : Taxon, key: string, depth: number, min?: number[], max?: number[]): [number[], number[]] {
    if(min == null || max == null){
      min = Array(_data[key].length).fill(Infinity);
      max = Array(_data[key].length).fill(-1);
    }
    if(_data.depth == depth){
      for (let i = 0; i < _data[key].length; i++) {
	min[i] = (_data[key][i] < min[i]) ? _data[key][i] : min[i];
	max[i] = (_data[key][i] > max[i]) ? _data[key][i] : max[i];
      }
    }
    var m;
    if(_data.children == null || _data.depth > depth){
      return [min, max];
    }
    for (let i = 0; i < _data.children.length; i++) {
      m = this.getRangeOfKeyAtDepth(_data.children[i], key, depth, min, max);
      min = m[0];
      max = m[1];
    }
    return [min, max];
  }

  removeChildrenAtDepth(node:Taxon, depth: number = 2): boolean {
    if(depth == 0){
      delete node.children;
      return true;
    }
    for (var i = 0; i < node.children.length; i++) {
      this.removeChildrenAtDepth(node.children[i], depth - 1);
    }
  }

  getPathToNode(node: Taxon, tax_id: number, path_root: Taxon[] = []): Taxon[] {
    if(node.tax_id == tax_id){
      path_root.push(node);
      return path_root;
    }
    if (node.children != null){
      let t: Taxon[];
      for (var i = 0; i < node.children.length; i++) {
	t = this.getPathToNode(node.children[i], tax_id, path_root);
	if(t.length != 0){
	  t.unshift(node);
	  return t;
	}
      }
    }
    return path_root;
  }
}
