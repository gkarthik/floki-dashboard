import { TestBed } from '@angular/core/testing';

import { TaxonomyTreeService } from './taxonomy-tree.service';

describe('TaxonomyTreeService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: TaxonomyTreeService = TestBed.get(TaxonomyTreeService);
    expect(service).toBeTruthy();
  });
});
