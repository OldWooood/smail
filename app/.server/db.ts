import { drizzle } from "drizzle-orm/d1";
import * as s from "~/drizzle/schema";

export const schema = s;

let db: ReturnType<typeof drizzle> | null = null;

export function d1Wrapper(d1: D1Database) {
	if (!db) {
		db = drizzle(d1, { schema });
	}
	return db;
}
