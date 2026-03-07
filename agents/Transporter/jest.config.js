/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 30000,
  verbose: true,
  // filesystem.js usa music-metadata/parseFile em saveCoverArt — pode deixar handles abertos
  detectOpenHandles: true,
  forceExit: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.js", "!src/index.js"],
};
