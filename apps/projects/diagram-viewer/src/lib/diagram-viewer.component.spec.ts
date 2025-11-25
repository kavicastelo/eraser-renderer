import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiagramViewerComponent } from './diagram-viewer.component';

describe('DiagramViewerComponent', () => {
  let component: DiagramViewerComponent;
  let fixture: ComponentFixture<DiagramViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiagramViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
