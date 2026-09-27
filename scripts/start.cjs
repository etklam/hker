// The standalone Next server is CommonJS; validate before loading its entry point.
/* eslint-disable @typescript-eslint/no-require-imports */
require("./runtime-env.cjs").validateRuntimeEnv();
require("../server.js");
