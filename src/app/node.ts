import { Taxon } from './taxon';

export class Node {
  x: number;
  y: number;
  size: number;
  fill: string;
  strokeStyle: string;
  textFill: string;
  lineWidth: number;
  children: Node[];
  parent: Node;
  data: Taxon;
}
