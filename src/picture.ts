export type Picture = {
  name: string;
  pos: [number, number];
  size: [number, number];
  cropRatio: number;
  blob: Blob;
  bitmap: ImageBitmap;
};
