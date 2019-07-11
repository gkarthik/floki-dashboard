import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodePathogenicTableComponent } from './node-pathogenic-table.component';

describe('NodePathogenicTableComponent', () => {
  let component: NodePathogenicTableComponent;
  let fixture: ComponentFixture<NodePathogenicTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NodePathogenicTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodePathogenicTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
