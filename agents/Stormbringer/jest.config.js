/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 60000,
  verbose: true,
  // saveCoverArt usa music-metadata/parseFile que pode deixar handles abertos
  detectOpenHandles: true,
  forceExit: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.js", "!src/index.js", "!src/cli.js"],
};
