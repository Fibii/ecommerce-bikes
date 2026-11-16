import { BundleBuilder } from "@/features/configurator/bundle-builder";
import { getApp } from "@/server/composition";

/** The catalog is static data (A5), so it is cached with the page shell. */
async function loadCatalog() {
  "use cache";
  return getApp().getCatalog();
}

export default async function Home() {
  const { bikes, accessories } = await loadCatalog();
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-semibold">Bike configurator</h1>
      <BundleBuilder bikes={bikes} accessories={accessories} />
    </main>
  );
}
