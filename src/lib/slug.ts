/** Sports Reference's player slug for a name, as the stat sheet stores it when it can
 *  leave the slug out. Must match playerSlug() in scripts/derive-data.mjs. */
export const playerSlug = (name: string) =>
  `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-")}-1`;
