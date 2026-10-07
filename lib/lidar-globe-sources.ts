export interface GlobeSource {
  id: string;
  label: string;
  provider: string;
  url: string;
  detail: string;
}

export const ESRI_WORLD_IMAGERY_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false";

export const AWS_TERRARIUM_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const OPENFREEMAP_PLANET = "https://tiles.openfreemap.org/planet";

const DC_LIDAR_IMAGE_SERVER = "https://imagery.dcgis.dc.gov/dcgis/rest/services/Lidar";

export type DcLidarProduct = "Intensity_2024" | "DSM_2024" | "nDSM_2024";

export function dcLidarTileUrl(product: DcLidarProduct): string {
  return `${DC_LIDAR_IMAGE_SERVER}/${product}/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png&transparent=true&f=image`;
}

// [west, south, east, north] extent of the District of Columbia LiDAR collection.
export const DC_LIDAR_BOUNDS: [number, number, number, number] = [-77.12, 38.79, -76.9, 39.0];

export const DC_LIDAR_PRODUCTS: { id: DcLidarProduct; label: string; detail: string }[] = [
  { id: "Intensity_2024", label: "INTENSITY", detail: "1 m return-intensity image" },
  { id: "DSM_2024", label: "DSM", detail: "Digital surface model (first return)" },
  { id: "nDSM_2024", label: "nDSM", detail: "Height above ground (DSM − DTM)" }
];

export const GLOBE_SOURCES: GlobeSource[] = [
  {
    id: "esri-world-imagery",
    label: "World Imagery (satellite / aerial)",
    provider: "Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, GIS User Community",
    url: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    detail:
      "Sub-meter photographic basemap in the U.S.; zoom 20–21 (~15–7.5 cm) in covered metro areas, zoom 19 (~30 cm) elsewhere. Missing high-zoom tiles fall back to the sharpest available level."
  },
  {
    id: "aws-terrain-tiles",
    label: "Terrain Tiles (Terrarium DEM)",
    provider: "Mapzen / AWS Open Data — includes USGS 3DEP (LiDAR-derived where available), SRTM, GMTED",
    url: "https://registry.opendata.aws/terrain-tiles/",
    detail: "Global elevation used for 3D terrain and hillshade."
  },
  {
    id: "dc-lidar-2024",
    label: "DC 2024 LiDAR (USGS QL1) — Intensity, DSM, nDSM",
    provider: "DC Office of the Chief Technology Officer (OCTO), Open Data DC",
    url: "https://opendata.dc.gov/search?q=2024%20lidar",
    detail:
      "Returns inside the U.S. Secret Service redaction boundary (White House area) were removed by the publisher except ground/water classes."
  },
  {
    id: "usgs-3dep-ept-ga",
    label: "Georgia USGS 3DEP LiDAR point clouds (35 surveys, 2009–2018)",
    provider: "U.S. Geological Survey 3D Elevation Program — Entwine Point Tiles on AWS Open Data (Hobu)",
    url: "https://registry.opendata.aws/usgs-lidar/",
    detail:
      "Classified airborne laser returns streamed from zoom 15 (full survey density, about 2–4 points per m², near the view centre) and drawn at measured height above ground. Survey dates vary by area; newer construction may be missing."
  },
  {
    id: "openfreemap-buildings",
    label: "Building footprints & heights",
    provider: "OpenFreeMap / OpenMapTiles, © OpenStreetMap contributors",
    url: "https://openfreemap.org/",
    detail: "Extruded by OSM render_height; not a survey-grade model."
  },
  {
    id: "nasa-svs-deep-star-maps-2020",
    label: "Deep Star Maps 2020 (4K / 8K star field behind the globe)",
    provider: "NASA Scientific Visualization Studio (SVS 4851) — Hipparcos-2, Tycho-2, Gaia DR2",
    url: "https://svs.gsfc.nasa.gov/4851",
    detail: "Rendered from 1.7 billion catalogued stars; 4096×2048 JPEG (8192×4096 in fullscreen on large displays) converted from the published EXR. Not aligned to the map camera."
  },
  {
    id: "loc-habs-dc37",
    label: "HABS DC-37 — The White House (measured drawings, photos)",
    provider: "Library of Congress / NPS Heritage Documentation Programs",
    url: "https://www.loc.gov/item/dc0402/",
    detail: "2025 NPS terrestrial laser scans are archival; point clouds are not published as a web service."
  }
];
