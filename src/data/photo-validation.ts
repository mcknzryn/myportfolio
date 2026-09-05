// This build-time module contains the runtime rules for the photo library.
// photos.ts calls it during normal builds, while photo-validation.test.ts calls
// it with small invented configurations. It returns nothing when data is valid
// and throws one combined Error when any invariants are broken.

// An `interface` is a TypeScript contract for an object's shape. The general
// `string` type is intentional: runtime validation must be able to inspect bad
// IDs, and tests should not depend on the real portfolio's PhotoId type.
export interface PhotoConfiguration {
  assetIds: readonly string[];
  metadata: Readonly<Record<string, { alt: string; decorative?: boolean }>>;
  homeIds: readonly string[];
  workColumns: readonly (readonly string[])[];
  favoriteIds: readonly string[];
  pinnedIds: readonly string[];
}

// `duplicates` is a private helper (it is not exported). `seen` remembers all
// IDs visited so far; `repeated` collects each duplicated ID only once. Set is
// a standard JavaScript collection whose values are always unique.
const duplicates = (ids: readonly string[]) => {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  ids.forEach((id) => {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  });

  return [...repeated].sort();
};

// The validator derives convenient collections once, then runs every rule and
// appends human-readable failures to `errors`. Checking all rules before
// throwing gives the person editing photos one complete repair list.
export function validatePhotoConfiguration(configuration: PhotoConfiguration) {
  // Destructuring gives local names to the configuration's properties.
  const { assetIds, metadata, homeIds, workColumns, favoriteIds, pinnedIds } =
    configuration;
  const errors: string[] = [];
  const metadataIds = Object.keys(metadata);
  const workIds = workColumns.flat();

  // These Sets are membership lookups. Their `has` method answers the repeated
  // question “does this ID exist in that part of the configuration?”
  const referencedIds = new Set([...homeIds, ...workIds]);
  const assetIdSet = new Set(assetIds);
  const metadataIdSet = new Set(metadataIds);
  const workIdSet = new Set(workIds);

  const duplicateAssets = duplicates(assetIds);
  const duplicateHomeIds = duplicates(homeIds);
  const duplicateWorkIds = duplicates(workIds);

  // Configuration lists cannot repeat the same underlying asset or placement.
  if (duplicateAssets.length > 0) {
    errors.push(`Duplicate photo asset IDs: ${duplicateAssets.join(", ")}`);
  }

  if (duplicateHomeIds.length > 0) {
    errors.push(`Duplicate Home photo IDs: ${duplicateHomeIds.join(", ")}`);
  }

  if (duplicateWorkIds.length > 0) {
    errors.push(
      `Photos placed more than once in Work: ${duplicateWorkIds.join(", ")}`,
    );
  }

  // Three columns are a production layout contract, not a flexible preference.
  if (workColumns.length !== 3) {
    errors.push(
      `Work must contain exactly three columns; received ${workColumns.length}.`,
    );
  }

  // Informative images require alt text. A deliberately decorative image may
  // use blank alt text only when its metadata explicitly says so.
  metadataIds.forEach((id) => {
    const entry = metadata[id];
    if (!entry.decorative && entry.alt.trim().length === 0) {
      errors.push(`Photo ${id} needs meaningful alt text or decorative: true.`);
    }
  });

  // Check both directions of the asset/metadata relationship, then require
  // every active asset to be used by at least one public gallery.
  assetIds.forEach((id) => {
    if (!metadataIdSet.has(id))
      errors.push(`Photo asset ${id} has no metadata.`);
    if (!referencedIds.has(id))
      errors.push(`Photo asset ${id} is not used by Home or Work.`);
  });

  metadataIds.forEach((id) => {
    if (!assetIdSet.has(id))
      errors.push(`Photo metadata ${id} has no matching asset.`);
  });

  // Every ID referenced anywhere must resolve to a real imported image.
  [...homeIds, ...workIds, ...favoriteIds, ...pinnedIds].forEach((id) => {
    if (!assetIdSet.has(id))
      errors.push(`Configured photo ${id} has no matching asset.`);
  });

  // Favorites and pins belong to the Work arrangement tool, so they may only
  // name photos that already appear in Work.
  [...favoriteIds, ...pinnedIds].forEach((id) => {
    if (!workIdSet.has(id))
      errors.push(`Arrange-mode photo ${id} is not placed in Work.`);
  });

  // `join` formats every accumulated message beneath one error heading.
  if (errors.length > 0) {
    throw new Error(`Invalid photo configuration:\n- ${errors.join("\n- ")}`);
  }
}
