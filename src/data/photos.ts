// This build-time module is the canonical photo library. It joins image files
// to human-written metadata and placement lists, validates that those sources
// agree, and exports ready-to-render photo records to the Home and Work
// components. See CODE_GUIDE.md for the full data flow and syntax glossary.

import type { ImageMetadata } from "astro";
import { validatePhotoConfiguration } from "./photo-validation";

// `imageModules` is a project-created name for the object returned by Astro's
// `import.meta.glob`. Each key is a matching file path, and each value is a
// module whose `default` export contains Astro's dimensions and image data.
// The generic `<...>` is a TypeScript description; `eager` loads every match
// now so the records below can be assembled during the build.
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/photos/*.{jpg,JPG,jpeg,JPEG,png,PNG,webp,WEBP,avif,AVIF}",
  { eager: true },
);

// `photoMetadata` is indexed by stable filename IDs. These descriptions are
// kept separate from gallery placement so the same photo and alt text can be
// reused on both Home and Work.
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

// `keyof typeof` derives the allowed ID strings from the actual metadata keys.
// `PhotoId` is our name for that type; it is not built into TypeScript.
export type PhotoId = keyof typeof photoMetadata;

// These are ID collections rather than full photo records. `as const` keeps
// their exact order and values, while `satisfies` checks every value against
// PhotoId without replacing the arrays' more specific inferred types.
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

// Work intentionally owns three explicit columns instead of computing a
// masonry order in the browser. The nested tuple after `satisfies` checks that
// exactly three readonly arrays are present.
export const workGalleryColumns = [
  ["29", "16", "01", "20", "34", "13", "00", "41", "35", "25", "46"],
  ["99", "22", "18", "26", "45", "09", "44", "23", "15", "11", "42"],
  ["02", "28", "10", "32", "06", "30", "31", "14", "12", "17", "37"],
] as const satisfies readonly [
  readonly PhotoId[],
  readonly PhotoId[],
  readonly PhotoId[],
];

// Arrange mode uses these author-controlled starting markers. `readonly`
// communicates that browser editing must create its own state rather than
// mutate this build-time configuration.
export const galleryFavorites: readonly PhotoId[] = [];
export const galleryPinned: readonly PhotoId[] = [];

// Two representations are useful here: `assetsById` is a fast ID-to-image
// lookup, while `assetIds` preserves every discovered entry for validation.
// A Map would collapse a duplicate key, so it cannot do both jobs by itself.
const assetsById = new Map<string, ImageMetadata>();
const assetIds: string[] = [];

// `Object.entries` turns the glob object into [path, module] pairs. For each
// pair, this callback takes the filename, removes its extension, and uses the
// remainder as the photo ID. Optional chaining (`?.`) accounts for the
// possibility that `pop` does not find a final path segment.
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

// Validation runs as soon as this module is loaded during the build. Passing
// one named object makes every input's role visible at the call site.
validatePhotoConfiguration({
  assetIds,
  metadata: photoMetadata,
  homeIds: homePhotoIds,
  workColumns: workGalleryColumns,
  favoriteIds: galleryFavorites,
  pinnedIds: galleryPinned,
});

// A `PhotoRecord` is the form the rendering components need: stable identity,
// Astro's imported image information, and accessible alternative text.
export interface PhotoRecord {
  id: PhotoId;
  image: ImageMetadata;
  alt: string;
}

// `getPhoto` expands one lightweight ID into its renderable record. Throwing
// here is a defensive fallback; normal builds should encounter missing assets
// earlier in validatePhotoConfiguration.
export function getPhoto(id: PhotoId): PhotoRecord {
  const image = assetsById.get(id);
  if (!image)
    throw new Error(`Photo ${id} is configured but its asset is missing.`);

  return { id, image, alt: photoMetadata[id].alt };
}

// `map` preserves each configured order while replacing every ID with the
// corresponding PhotoRecord. Work maps twice because it has columns, then
// photos inside each column.
export const homePhotos = homePhotoIds.map(getPhoto);
export const workPhotoColumns = workGalleryColumns.map((column) =>
  column.map(getPhoto),
);
