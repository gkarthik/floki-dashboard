export class Taxon {
  constructor() {
  }
  tax_id: number;
  taxon_name: string;
  parent: string;		// Change to number
  depth: number;
  rank: string;
  ctrl_reads: number;
  ctrl_taxon_reads: number;
  ctrl_percentage: number;
  ctrl_kmer_depth: number;
  ctrl_kmer_coverage: number;
  ctrl_average_forward_read_length: number;
  ctrl_average_reverse_read_length: number;
  ctrl_forward_score_distribution: string;
  ctrl_reverse_scoe_distribution: string;
  reads: [];
  taxon_reads: [];
  percentage: [];
  pvalue: [];
  oddsratio: [];
  kmer_depth: [];
  kmer_coverage: [];
  file: [];
  pathogenic: number;
  diseases: [];
  children: Taxon[];
  num_nodes: number;
  average_forward_read_length: number[];
  average_reverse_read_length: number[];
  forward_score_distribution: string[];
  reverse_scoe_distribution: string[];
}
