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
}
