import { nanoid } from "nanoid";

export const MAILBOX_STATE_PREFIX = "mailbox-state:";

// Claim keys (`mailbox:`) mark an address as currently owned. Always built
// lowercased on both the claim path (Remix action) and the check path
// (email worker) so casing can never cause a miss.
export const MAILBOX_PREFIX = "mailbox:";

export function mailboxClaimKey(email: string) {
	return `${MAILBOX_PREFIX}${email.toLowerCase()}`;
}

export function mailboxStateKey(email: string) {
	return `${MAILBOX_STATE_PREFIX}${email.toLowerCase()}`;
}

// State keys only back ETag polling; a missing key just means "full fetch".
// TTL bounds KV growth: one key per address ever created would otherwise
// accumulate forever.
export const MAILBOX_STATE_TTL_SECONDS = 60 * 60 * 24 * 7;

export function nextMailboxStateToken() {
	return `${Date.now().toString(36)}-${nanoid(10)}`;
}

export function quoteEtag(token: string) {
	return `"${token}"`;
}
