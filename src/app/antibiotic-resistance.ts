export class AntibioticResistance {
  constructor() {
  }
  sample: string;
  data: {
    ncbi_accession_id: string;
    aro_accession: string;
    avg_depth_per_base: number;
    coverage: number;
  }[];
  card_data: {}[];
}
