// https://kulshekhar.github.io/ts-jest/user/config/
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    modulePaths: ["<rootDir>/"],
    verbose: true,
    globalSetup: "<rootDir>/test-setup.ts",
};
