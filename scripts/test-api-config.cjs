const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../src/api-config.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
function apiModule(URLConstructor = URL) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    URL: URLConstructor,
  });
  return module.exports;
}
const { resolveApiConfiguration, apiConnectionError } = apiModule();
const development = (platform, changes = {}) =>
  resolveApiConfiguration({ platform, development: true, ...changes });
const release = (configuredUrl) =>
  resolveApiConfiguration({
    platform: "ios",
    development: false,
    configuredUrl,
  });

test("blank development configuration uses the correct host for each preview platform", () => {
  assert.equal(development("ios").baseUrl, "http://127.0.0.1:3001");
  assert.equal(
    development("android", { configuredUrl: "  " }).baseUrl,
    "http://10.0.2.2:3001",
  );
  assert.equal(
    development("web", { webHostname: "localhost" }).baseUrl,
    "http://localhost:3001",
  );
  assert.equal(
    development("web", { webHostname: "192.168.1.20" }).baseUrl,
    "http://192.168.1.20:3001",
  );
  assert.equal(development("ios").source, "development-default");
});

test("release configuration must be explicit and secure instead of silently using an emulator", () => {
  for (const url of [
    undefined,
    "",
    " \n ",
    "http://api.solace.test",
    "http://192.168.1.20:3001",
  ]) {
    const result = release(url);
    assert.equal(result.baseUrl, null);
    assert.match(result.error, /configured HTTPS API/);
  }
  assert.equal(
    release("https://api.solace.test").baseUrl,
    "https://api.solace.test",
  );
  assert.equal(
    release("https://127.api.solace.test").baseUrl,
    "https://127.api.solace.test",
    "a public DNS label is not an IPv4 loopback address",
  );
});

test("a public URL is normalized without losing a reverse-proxy base path", () => {
  const result = development("ios", {
    configuredUrl: "  HTTPS://API.SOLACE.TEST/companion///  ",
  });
  assert.equal(result.baseUrl, "https://api.solace.test/companion");
  assert.equal(result.origin, "https://api.solace.test");
  assert.equal(result.source, "environment");
  assert.equal(result.error, null);
});

test("unsupported protocols and repaired or malformed URL forms are rejected", () => {
  for (const url of [
    "api.solace.test",
    "/api",
    "https://",
    "https:///",
    "https:///api.solace.test",
    "https://api .test",
    "https:\\\\api.solace.test",
    "ftp://api.solace.test",
    "javascript:alert(1)",
    "http://localhost:70000",
  ]) {
    const result = development("ios", { configuredUrl: url });
    assert.equal(result.baseUrl, null, url);
    assert.match(result.error, /API address is invalid/, url);
  }
});

test("credentials, query parameters and fragments are not accepted or echoed into diagnostics", () => {
  for (const url of [
    "https://person:private-value@api.solace.test",
    "https://@api.solace.test",
    "https://api.solace.test?key=private-value",
    "https://api.solace.test#private-value",
    "https://api.solace.test?",
    "https://api.solace.test#",
  ]) {
    const result = development("ios", { configuredUrl: url });
    assert.equal(result.baseUrl, null);
    assert.ok(!result.error.includes("private-value"));
  }
});

test("HTTPS loopback and emulator-only addresses cannot masquerade as release API configuration", () => {
  for (const host of [
    "localhost",
    "localhost.",
    "sub.localhost",
    "127.1",
    "127.0.0.2",
    "0.0.0.0",
    "[::1]",
    "[::]",
    "10.0.2.2",
    "10.0.3.2",
  ]) {
    const result = release(`https://${host}`);
    assert.equal(result.baseUrl, null, host);
    assert.match(result.error, /configured HTTPS API/, host);
  }
});

test("IPv6 preview hosts preserve their full address and receive only one bracket pair", () => {
  for (const webHostname of ["::1", "[::1]"]) {
    assert.equal(
      development("web", { webHostname }).baseUrl,
      "http://[::1]:3001",
    );
  }
  assert.equal(
    development("web", { webHostname: "[2001:db8::1]" }).baseUrl,
    "http://[2001:db8::1]:3001",
  );
  assert.equal(
    development("ios", { configuredUrl: "http://[::1]:3001/" }).baseUrl,
    "http://[::1]:3001",
  );
  for (const webHostname of [
    "hostname/path",
    "person@hostname",
    "hostname:8081",
    "[invalid]",
  ]) {
    assert.equal(
      development("web", { webHostname }).baseUrl,
      null,
      webHostname,
    );
  }
});

test("development errors identify only the server origin and a useful recovery, not private request paths", () => {
  const config = development("ios", {
    configuredUrl: "https://api.solace.test/private-routing-prefix",
  });
  const message = apiConnectionError(config, false);
  assert.match(
    message,
    /Unable to connect to Solace at https:\/\/api\.solace\.test/,
  );
  assert.match(message, /same Mac/);
  assert.match(message, /\/api\/health/);
  assert.ok(!message.includes("private-routing-prefix"));
  assert.match(apiConnectionError(config, true), /taking too long/);
  assert.match(
    apiConnectionError(development("android"), false),
    /Android emulator/,
  );
});

test("release network and timeout messages remain generic", () => {
  const config = release("https://api.solace.test/private-routing-prefix");
  assert.equal(
    apiConnectionError(config, false),
    "Unable to connect to Solace. Check your connection and try again.",
  );
  assert.equal(
    apiConnectionError(config, true),
    "Solace is taking too long to respond. Please try again.",
  );
});

test("the installed Expo URL implementation supports the same native configuration contract", () => {
  const { resolveApiConfiguration: nativeResolve } = apiModule(
    require("whatwg-url-minimum").URL,
  );
  const options = [
    { platform: "ios", development: true },
    { platform: "android", development: true },
    { platform: "web", development: true, webHostname: "[::1]" },
    {
      platform: "ios",
      development: false,
      configuredUrl: "https://api.solace.test/prefix/",
    },
    {
      platform: "ios",
      development: false,
      configuredUrl: "https://127.0.0.1:3001",
    },
  ];
  for (const input of options) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(nativeResolve(input))),
      JSON.parse(JSON.stringify(resolveApiConfiguration(input))),
    );
  }
});
