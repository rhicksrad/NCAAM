declare module "d3-shape" {
  export interface PieArcDatum<Datum> {
    data: Datum;
    value: number;
    index: number;
    startAngle: number;
    endAngle: number;
    padAngle: number;
  }

  interface ArcGenerator<Datum> {
    (datum: PieArcDatum<Datum>): string | null;
    innerRadius(radius: number): this;
    outerRadius(radius: number): this;
    cornerRadius(radius: number): this;
    padAngle(angle: number): this;
  }

  interface PieGenerator<Datum> {
    (data: readonly Datum[]): PieArcDatum<Datum>[];
    value(accessor: (datum: Datum, index: number, data: readonly Datum[]) => number): this;
    sort(compare: ((a: Datum, b: Datum) => number) | null): this;
  }

  export function arc<Datum = any>(): ArcGenerator<Datum>;
  export function pie<Datum = any>(): PieGenerator<Datum>;
}
