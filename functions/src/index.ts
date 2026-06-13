/**
 * Cloud Functions entrypoint.
 *
 * Phase 1 adds `authWithWca`: a callable/HTTPS function that exchanges a WCA
 * OAuth code, verifies the user holds a delegate/organizer/staff role in the
 * selected competition's WCIF, writes the membership doc, and mints a Firebase
 * custom token. Until then this is an empty module so the codebase builds.
 */
export {};
