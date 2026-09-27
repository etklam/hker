const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  url.pathname !== "/hker_directory_test" ||
  process.env.ALLOW_DIRECTORY_TEST_RESET !== "1"
) {
  throw new Error("Integration tests require a disposable loopback hker_directory_test database and ALLOW_DIRECTORY_TEST_RESET=1");
}
