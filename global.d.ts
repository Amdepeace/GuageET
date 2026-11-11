declare module "*.geojson" {
  const value: { type: "FeatureCollection"; features: unknown[] };
  export default value;
}
