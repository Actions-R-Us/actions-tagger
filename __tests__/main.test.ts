import * as core from '@actions/core';

describe("publish_latest tests", () => {
    test("not published when false", async () => {
        process.env.INPUT_PUBLISH_LATEST = 'false';
        expect(core.getInput('publish_latest')).toEqual('false')
    });

    test("published when true", async () => {
        process.env.INPUT_PUBLISH_LATEST = "true";
        expect(core.getInput('publish_latest')).toEqual('true')
    });
});
