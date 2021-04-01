import { Octokit } from "@octokit/core";

beforeEach(() => jest.resetModules());
afterEach(() => jest.restoreAllMocks());

describe("getPreferredRef()", () => {
    it("Should be heads", () => {
        process.env.INPUT_PREFER_BRANCH_RELEASES = "true";
        return import("src/functions").then(({ default: { getPreferredRef } }) =>
            expect(getPreferredRef()).toBe("heads")
        );
    });

    it("Should be tags", () => {
        process.env.INPUT_PREFER_BRANCH_RELEASES = "false";
        return import("src/functions").then(({ default: { getPreferredRef } }) =>
            expect(getPreferredRef()).toBe("tags")
        );
    });
});

describe("findLatestReleases()", () => {
    beforeEach(() => {
        process.env.GITHUB_REPOSITORY = "test/test";
    });

    const octokit = new Octokit();

    it("Should find the latest release when only one release exists", async () => {
        const currentTag = '3.0.1';
        const spyOctokit = jest.spyOn(octokit, 'graphql').mockImplementation(async () => Promise.resolve({
            repository: {
                refs: {
                    refsList: [{
                        ref: {
                            name: `v${currentTag}`
                        }
                    }],
                    pageInfo: {
                        endCursor: "MTA",
                        hasNextPage: false
                    },
                    totalCount: 1
                }
            }
        }));

        jest.mock('src/functions');

        return await import('src/functions').then(({default: {findLatestReleases, releaseTag}}) => {
            // @ts-expect-error
            releaseTag.mockedTag = `v${currentTag}`;
            return findLatestReleases(octokit).then(({ repoLatest }) => {
                expect(spyOctokit).toHaveBeenCalledTimes(1);
                expect(repoLatest).toBe(currentTag);
            });
        });
    });
});
