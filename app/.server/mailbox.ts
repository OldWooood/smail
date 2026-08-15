import { nanoid } from "nanoid";

export const MAILBOX_STATE_PREFIX = "mailbox-state:";

export function mailboxStateKey(email: string) {
	return `${MAILBOX_STATE_PREFIX}${email.toLowerCase()}`;
}

export function nextMailboxStateToken() {
	return `${Date.now().toString(36)}-${nanoid(10)}`;
}

export function quoteEtag(token: string) {
	return `"${token}"`;
}
