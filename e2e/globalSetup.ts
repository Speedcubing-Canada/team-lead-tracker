import { startFakeWca } from "./fakeWca";

export default async function globalSetup() {
  const server = await startFakeWca();
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
