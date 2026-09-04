export interface PhotoConfiguration {
  assetIds: readonly string[];
  metadata: Readonly<Record<string, { alt: string; decorative?: boolean }>>;
  homeIds: readonly string[];
  workColumns: readonly (readonly string[])[];
  favoriteIds: readonly string[];
  pinnedIds: readonly string[];
}

const duplicates = (ids: readonly string[]) => {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  ids.forEach((id) => {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  });

  return [...repeated].sort();
};

export function validatePhotoConfiguration(configuration: PhotoConfiguration) {
  const { assetIds, metadata, homeIds, workColumns, favoriteIds, pinnedIds } =
    configuration;
  const errors: string[] = [];
  const metadataIds = Object.keys(metadata);
  const workIds = workColumns.flat();
  const referencedIds = new Set([...homeIds, ...workIds]);
  const assetIdSet = new Set(assetIds);
  const metadataIdSet = new Set(metadataIds);
  const workIdSet = new Set(workIds);

  const duplicateAssets = duplicates(assetIds);
  const duplicateHomeIds = duplicates(homeIds);
  const duplicateWorkIds = duplicates(workIds);

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

  if (workColumns.length !== 3) {
    errors.push(
      `Work must contain exactly three columns; received ${workColumns.length}.`,
    );
  }

  metadataIds.forEach((id) => {
    const entry = metadata[id];
    if (!entry.decorative && entry.alt.trim().length === 0) {
      errors.push(`Photo ${id} needs meaningful alt text or decorative: true.`);
    }
  });

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

  [...homeIds, ...workIds, ...favoriteIds, ...pinnedIds].forEach((id) => {
    if (!assetIdSet.has(id))
      errors.push(`Configured photo ${id} has no matching asset.`);
  });

  [...favoriteIds, ...pinnedIds].forEach((id) => {
    if (!workIdSet.has(id))
      errors.push(`Arrange-mode photo ${id} is not placed in Work.`);
  });

  if (errors.length > 0) {
    throw new Error(`Invalid photo configuration:\n- ${errors.join("\n- ")}`);
  }
}
