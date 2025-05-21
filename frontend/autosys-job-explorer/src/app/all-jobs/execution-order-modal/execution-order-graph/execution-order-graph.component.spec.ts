import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutionOrderGraphComponent } from './execution-order-graph.component';

describe('ExecutionOrderGraphComponent', () => {
  let component: ExecutionOrderGraphComponent;
  let fixture: ComponentFixture<ExecutionOrderGraphComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ExecutionOrderGraphComponent]
    });
    fixture = TestBed.createComponent(ExecutionOrderGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
