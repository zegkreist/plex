/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},
  extensionsToTreatAsEsm: [".js"],
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 30000,
  verbose: true,
};
