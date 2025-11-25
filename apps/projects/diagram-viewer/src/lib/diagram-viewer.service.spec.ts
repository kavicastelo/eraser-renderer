import { TestBed } from '@angular/core/testing';

import { DiagramViewerService } from './diagram-viewer.service';

describe('DiagramViewerService', () => {
  let service: DiagramViewerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DiagramViewerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
