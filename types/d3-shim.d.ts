declare module "d3-axis" {
  export type AxisDomain = string | number | Date;
  export function axisBottom(...args: any[]): any;
  export function axisLeft(...args: any[]): any;
}

declare module "d3-array" {
  export function extent<T>(values: Iterable<T>, accessor?: (value: T, index: number) => number): [number, number];
}

declare module "d3-scale" {
  export type ScaleBand<T = any> = {
    (value: T): number | undefined;
    domain(values: readonly T[]): ScaleBand<T>;
    range(range: readonly [number, number]): ScaleBand<T>;
    bandwidth(): number;
    paddingInner(value: number): ScaleBand<T>;
    paddingOuter(value: number): ScaleBand<T>;
  };
  export type ScalePoint<T = any> = {
    (value: T): number | undefined;
    domain(values: readonly T[]): ScalePoint<T>;
    range(range: readonly [number, number]): ScalePoint<T>;
    padding(value: number): ScalePoint<T>;
  };
  export type ScaleLinear<Range = any, Output = any> = {
    (value: number): Output;
    domain(values: readonly number[]): ScaleLinear<Range, Output>;
    range(range: readonly [Range, Range]): ScaleLinear<Range, Output>;
    clamp(clamped: boolean): ScaleLinear<Range, Output>;
    nice(): ScaleLinear<Range, Output>;
  };
  export type ScaleTime<Range = any, Output = any> = {
    (value: Date): Output;
    domain(values: readonly Date[]): ScaleTime<Range, Output>;
    range(range: readonly [Range, Range]): ScaleTime<Range, Output>;
    nice(): ScaleTime<Range, Output>;
  };
  export function scaleBand<T = any>(): ScaleBand<T>;
  export function scalePoint<T = any>(): ScalePoint<T>;
  export function scaleLinear(): ScaleLinear;
  export function scaleTime(): ScaleTime;
}

declare module "d3-selection" {
  export interface Selection<GElement = any, Datum = any, PElement = any, PDatum = any> {
    node(): GElement | null;
    empty(): boolean;
    data(data: readonly Datum[]): Selection<GElement, Datum, PElement, PDatum>;
    data(data: readonly Datum[], key: (datum: Datum, index: number) => string | number): Selection<GElement, Datum, PElement, PDatum>;
    enter(): Selection<GElement, Datum, PElement, PDatum>;
    exit(): Selection<GElement, Datum, PElement, PDatum>;
    merge(other: Selection<GElement, Datum, PElement, PDatum>): Selection<GElement, Datum, PElement, PDatum>;
    append(name: string): Selection<GElement, Datum, PElement, PDatum>;
    attr(name: string, value: any): Selection<GElement, Datum, PElement, PDatum>;
    style(name: string, value: any): Selection<GElement, Datum, PElement, PDatum>;
    text(value: any): Selection<GElement, Datum, PElement, PDatum>;
    call(fn: (selection: Selection<GElement, Datum, PElement, PDatum>) => void): Selection<GElement, Datum, PElement, PDatum>;
    on(type: string, listener: any): Selection<GElement, Datum, PElement, PDatum>;
    select<Desc = any>(selector: string): Selection<Desc, Datum, PElement, PDatum>;
    selectAll<Desc = any>(selector: string): Selection<Desc, any, GElement, Datum>;
    remove(): Selection<GElement, Datum, PElement, PDatum>;
    join(name: string): Selection<GElement, Datum, PElement, PDatum>;
    each(callback: (this: GElement, datum: Datum, index: number) => void): Selection<GElement, Datum, PElement, PDatum>;
  }
  export function select<GElement = any>(element: GElement | string): Selection<GElement, unknown, null, undefined>;
  export function selectAll<GElement = any>(selector: string): Selection<GElement, unknown, null, undefined>;
  export function pointer(event: any, target?: any): [number, number];
}

declare module "d3-shape" {
  export function area<T = any>(): any;
  export function line<T = any>(): any;
  export const curveLinear: any;
  export const curveMonotoneX: any;
}

declare module "d3-format" {
  export function format(specifier: string): (value: number) => string;
}
