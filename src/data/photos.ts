import type { ImageMetadata } from "astro";
import { validatePhotoConfiguration } from "./photo-validation";

const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/photos/*.{jpg,JPG,jpeg,JPEG,png,PNG,webp,WEBP,avif,AVIF}",
  { eager: true },
);

export const photoMetadata = {
  "00": { alt: "Woman holding a glass of red wine over a tiled table" },
  "01": { alt: "Red wine being poured between two glasses outdoors at night" },
  "02": { alt: "Two wine bottles tucked beneath a woman's denim jacket" },
  "06": { alt: "Hand lifting a white cup from a book on an outdoor bench" },
  "09": { alt: "Wine map on a table framed by a blurred bottle and glass" },
  "10": { alt: "Kruger-Rumpf wine bottles chilled in ice" },
  "11": { alt: "Person presenting a wine bottle beside a glass of red wine" },
  "12": { alt: "Woman pouring wine for a guest at a tasting table" },
  "13": { alt: "Red wine being poured into a glass at a tasting" },
  "14": { alt: "Corkscrew resting in a wine bottle among other bottles" },
  "15": { alt: "Liqueur being poured into a small glass at a tasting booth" },
  "16": {
    alt: "Bottle of Weiss wine arranged with radishes, denim, and a straw hat",
  },
  "17": { alt: "Pastry and orange slices served on white ceramics" },
  "18": { alt: "Sliced orange and a white cup arranged on a wooden board" },
  "20": { alt: "Woman holding a bottle of red wine over a wooden railing" },
  "22": { alt: "Empty wine glass held over a dark garden backdrop" },
  "23": { alt: "Bottle of Schloss Lieser Riesling chilled on ice" },
  "25": {
    alt: "Red wine bottle arranged with peaches, an open book, and denim",
  },
  "26": { alt: "Close crop of a smiling red-haired woman in a denim jacket" },
  "28": {
    alt: "Picnic spread of white ceramics, fruit, pastries, and flowers",
  },
  "29": { alt: "Woman arranging yellow flowers on a wooden picnic tray" },
  "30": {
    alt: "White ceramic tableware, pastries, and flowers arranged outdoors",
  },
  "31": {
    alt: "Woman in a striped dress seated beside a cup and books on a bench",
  },
  "32": {
    alt: "Yellow flowers and rings arranged on white ceramics and a wooden tray",
  },
  "34": {
    alt: "Outdoor picnic spread with oranges, pastries, white ceramics, and flowers",
  },
  "35": {
    alt: "White ceramics, fruit, tea, and flowers arranged on a picnic blanket",
  },
  "37": {
    alt: "Cup of pink tea and flowers resting on books on an outdoor bench",
  },
  "41": {
    alt: "Woman holding a bottle while speaking to a guest at a wine tasting",
  },
  "42": {
    alt: "Hands presenting a wine bottle with a colorful patterned label",
  },
  "44": { alt: "Man pouring wine at a tasting table" },
  "45": { alt: "Hirsch wine bottles chilled in ice" },
  "46": { alt: "Wine being poured into a glass at a tasting" },
  "99": { alt: "Oranges and an apple arranged on a sunlit picnic blanket" },
} as const;

export type PhotoId = keyof typeof photoMetadata;

export const homePhotoIds = [
  "01",
  "18",
  "02",
  "20",
  "29",
  "99",
  "00",
  "16",
  "30",
  "31",
  "25",
  "45",
  "13",
  "14",
  "22",
  "26",
  "37",
  "34",
  "44",
  "11",
  "06",
  "32",
  "10",
  "09",
  "17",
] as const satisfies readonly PhotoId[];

export const workGalleryColumns = [
  ["29", "16", "01", "20", "34", "13", "00", "41", "35", "25", "46"],
  ["99", "22", "18", "26", "45", "09", "44", "23", "15", "11", "42"],
  ["02", "28", "10", "32", "06", "30", "31", "14", "12", "17", "37"],
] as const satisfies readonly [
  readonly PhotoId[],
  readonly PhotoId[],
  readonly PhotoId[],
];

export const galleryFavorites: readonly PhotoId[] = [];
export const galleryPinned: readonly PhotoId[] = [];

const assetsById = new Map<string, ImageMetadata>();
const assetIds: string[] = [];

Object.entries(imageModules).forEach(([path, module]) => {
  const id = path
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "");
  if (id) {
    assetIds.push(id);
    assetsById.set(id, module.default);
  }
});

validatePhotoConfiguration({
  assetIds,
  metadata: photoMetadata,
  homeIds: homePhotoIds,
  workColumns: workGalleryColumns,
  favoriteIds: galleryFavorites,
  pinnedIds: galleryPinned,
});

export interface PhotoRecord {
  id: PhotoId;
  image: ImageMetadata;
  alt: string;
}

export function getPhoto(id: PhotoId): PhotoRecord {
  const image = assetsById.get(id);
  if (!image)
    throw new Error(`Photo ${id} is configured but its asset is missing.`);

  return { id, image, alt: photoMetadata[id].alt };
}

export const homePhotos = homePhotoIds.map(getPhoto);
export const workPhotoColumns = workGalleryColumns.map((column) =>
  column.map(getPhoto),
);
