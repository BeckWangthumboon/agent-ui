/**
 * TODO(auth-web): Add WorkOS webhook handlers (`user.created`, `user.updated`, `user.deleted`)
 * once webhook signing, retries, and deployment routing are finalized for this repo.
 *
 * This auth bootstrap intentionally relies on `ensureAccount` during sign-in callback and
 * protected-route load to keep account records in sync without introducing webhook risk yet.
 */
export {};
