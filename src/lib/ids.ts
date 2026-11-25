// Record ids are UUIDs. One check for all of them (#372), so a form value,
// URL param, or storage path is held to the same shape everywhere.

/** A lowercase UUID, as a regex source to build longer patterns (storage paths). */
export const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const UUID = new RegExp(`^${UUID_SOURCE}$`, "i");

/** Whether a value is a UUID, in either case. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
