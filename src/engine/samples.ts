import { SlideImage } from '../types/studio';

export interface SampleAssetSpec {
  id: string;
  name: string;
  url: string;
}

export const SAMPLE_ASSETS: SampleAssetSpec[] = [
  {
    id: 'sample-coastal',
    name: 'coastal-cliffs.jpg',
    url: '/src/assets/images/sample_coastal_cliff_1795253374819.jpg',
  },
  {
    id: 'sample-alpine',
    name: 'alpine-sunrise.jpg',
    url: '/src/assets/images/sample_alpine_lake_1795253375173.jpg',
  },
  {
    id: 'sample-garden',
    name: 'twilight-garden.jpg',
    url: '/src/assets/images/sample_garden_celebration_1795253375031.jpg',
  },
  {
    id: 'sample-rooftop',
    name: 'rooftop-dusk.jpg',
    url: '/src/assets/images/sample_city_nightlife_1795253375184.jpg',
  },
];

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function loadSampleSlides(): Promise<SlideImage[]> {
  const loaded = await Promise.all(
    SAMPLE_ASSETS.map(async (item) => {
      const element = await loadImageElement(item.url);
      return {
        id: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: item.name,
        url: item.url,
        width: element.naturalWidth || 1600,
        height: element.naturalHeight || 900,
        element,
        isSample: true,
      } satisfies SlideImage;
    })
  );
  return loaded;
}

export async function filesToSlides(files: FileList | File[]): Promise<SlideImage[]> {
  const imageFiles = Array.from(files).filter((file) =>
    file.type.startsWith('image/')
  );

  const results = await Promise.all(
    imageFiles.map(async (file) => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const element = await loadImageElement(objectUrl);
        return {
          id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url: objectUrl,
          width: element.naturalWidth || 1280,
          height: element.naturalHeight || 720,
          element,
          isSample: false,
        } satisfies SlideImage;
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        throw err;
      }
    })
  );

  return results;
}
