import { polygonError } from './geometry';
describe('floor geometry', () => {
  it('accepts normalized boundary coordinates and concave polygons', () => {
    expect(
      polygonError([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
    ).toBeNull();
  });
  it('rejects crossed, repeated, collinear and out-of-canvas vertices', () => {
    for (const points of [
      [],
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1.1, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
    ])
      expect(polygonError(points)).toBeTruthy();
  });
});
