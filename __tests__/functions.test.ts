beforeEach(() => jest.resetModules());

describe("getPreferredRef()", () => {
    test("Should be heads", () => {
        jest.doMock("src", () => ({
            preferences: { preferBranchRelease: true },
        }));
        return import("src/functions").then(({ getPreferredRef }) =>
            expect(getPreferredRef()).toBe("heads")
        );
    });

    test("Should be tags", () => {
        jest.doMock("src", () => ({
            preferences: { preferBranchRelease: false },
        }));
        return import("src/functions").then(({ getPreferredRef }) =>
            expect(getPreferredRef()).toBe("tags")
        );
    });
});
