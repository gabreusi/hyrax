import { afterEach } from "vitest";

// Testing Library only unmounts by itself when the test globals are on; here they are off.
// A server-render test runs in plain Node, where there is no document and nothing to clean up.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
