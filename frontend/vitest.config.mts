import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The "@/" import alias of tsconfig.json, so component tests can import like the app does.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
