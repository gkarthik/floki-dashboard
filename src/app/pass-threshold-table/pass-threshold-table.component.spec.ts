import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PassThresholdTableComponent } from './pass-threshold-table.component';

describe('PassThresholdTableComponent', () => {
  let component: PassThresholdTableComponent;
  let fixture: ComponentFixture<PassThresholdTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PassThresholdTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PassThresholdTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
