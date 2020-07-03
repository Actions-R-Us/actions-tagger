// https://kulshekhar.github.io/ts-jest/user/config/
// https://jestjs.io/docs/en/configuration

// https://docs.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables
const bail = process.env.CI == "true" ? 0 : 1;

module.exports = {
    bail,
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        // Note: Order is IMPORTANT!
        // Inner modules before outer ones
        "^src(?:/(.+))?$": ["<rootDir>/src/$1", "<rootDir>/src"],
    },
    verbose: false,
    globalSetup: "<rootDir>/tests/test-setup.ts",
};
