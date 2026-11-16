import { BundleBuilder } from "@/features/configurator/bundle-builder";
import { getCachedCatalog } from "@/server/catalog-cache";

export default async function Home() {
  const { bikes, accessories } = await getCachedCatalog();
  return (
    <main id="main" className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-semibold">Bike configurator</h1>
      <BundleBuilder bikes={bikes} accessories={accessories} />
    </main>
  );
}
