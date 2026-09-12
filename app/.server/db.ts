import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as s from "~/drizzle/schema";

export const schema = s;

export type DBDatabase = DrizzleD1Database<typeof s>;

// Use a WeakMap keyed by the D1 binding instance instead of a global singleton.
// On Workers the module scope is reused across requests, and different
// requests can carry different bindings (preview vs production, env rotation).
// A plain `let db` would pin the first binding forever.
const dbCache = new WeakMap<object, DBDatabase>();

export function d1Wrapper(d1: D1Database) {
	const cached = dbCache.get(d1 as object);
	if (cached) return cached;
	const fresh = drizzle(d1, { schema });
	dbCache.set(d1 as object, fresh);
	return fresh;
}
