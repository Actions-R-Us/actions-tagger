beforeEach(() => jest.resetModules());

describe("getPreferredRef()", () => {
    it("Should be heads", () => {
        process.env.INPUT_PREFER_BRANCH_RELEASES = "true";
        return import("src/functions").then(({ getPreferredRef }) =>
            expect(getPreferredRef()).toBe("heads")
        );
    });

    it("Should be tags", () => {
        process.env.INPUT_PREFER_BRANCH_RELEASES = "false";
        return import("src/functions").then(({ getPreferredRef }) =>
            expect(getPreferredRef()).toBe("tags")
        );
    });
});
