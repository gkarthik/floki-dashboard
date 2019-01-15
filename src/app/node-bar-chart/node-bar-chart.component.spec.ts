import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeBarChartComponent } from './node-bar-chart.component';

describe('NodeBarChartComponent', () => {
  let component: NodeBarChartComponent;
  let fixture: ComponentFixture<NodeBarChartComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NodeBarChartComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeBarChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
