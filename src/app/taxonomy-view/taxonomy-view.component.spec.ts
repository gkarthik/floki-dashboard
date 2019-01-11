import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxonomyViewComponent } from './taxonomy-view.component';

describe('TaxonomyViewComponent', () => {
  let component: TaxonomyViewComponent;
  let fixture: ComponentFixture<TaxonomyViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TaxonomyViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TaxonomyViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
