import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RegressionComponent } from './regression.component';

describe('RegressionComponent', () => {
  let component: RegressionComponent;
  let fixture: ComponentFixture<RegressionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RegressionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RegressionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
