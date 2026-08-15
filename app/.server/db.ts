import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "~/drizzle/schema";

export const schema = s;

export type DBDatabase = DrizzleD1Database<typeof s>;

let db: DBDatabase | null = null;

export function d1Wrapper(d1: D1Database) {
	if (!db) {
		db = drizzle(d1, { schema });
	}
	return db;
}
