// Without the emulators, the Admin SDK falls back to the gcloud default project: prod.
const env = import.meta.env as Record<string, string | undefined>;
if (!env["FIRESTORE_EMULATOR_HOST"] || !env["GCLOUD_PROJECT"]?.startsWith("demo-")) {
  throw new Error("Integration tests only run against the emulators: use `npm run test:int`.");
}
