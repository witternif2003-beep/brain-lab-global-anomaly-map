import proj4 from 'proj4';

/** proj4 definitions for every CRS used by the Georgia 1 m DEM tiles (USGS S1M and 3DEP 1 m projects). */
export const SOURCE_CRS: Record<number, string> = {
  6350: '+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  26916: '+proj=utm +zone=16 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  26917: '+proj=utm +zone=17 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
};

export interface Converter { forward(p: number[]): number[]; inverse(p: number[]): number[] }

const converters = new Map<number, Converter>();

export function lonLatConverter(epsg: number): Converter {
  let c = converters.get(epsg);
  if (!c) {
    const def = SOURCE_CRS[epsg];
    if (!def) throw new Error(`Unsupported CRS EPSG:${epsg}`);
    c = proj4('EPSG:4326', def) as Converter;
    converters.set(epsg, c);
  }
  return c;
}
