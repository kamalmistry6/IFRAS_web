import { pageRange } from './pagination';

describe('pageRange', () => {
  it('gives the rows and the number of pages', () => {
    expect(pageRange(57, 1)).toEqual({ from: 1, to: 20, totalPages: 3 });
    expect(pageRange(57, 3)).toEqual({ from: 41, to: 57, totalPages: 3 });
  });

  it('copes with an empty list and an exact last page', () => {
    expect(pageRange(0, 1)).toEqual({ from: 0, to: 0, totalPages: 1 });
    expect(pageRange(40, 2)).toEqual({ from: 21, to: 40, totalPages: 2 });
  });
});
