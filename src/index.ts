export interface TaggedRelease {
    ref: string;
    latest: boolean;
}

export interface LatestRelease {
    repoLatest: string;
    majorLatest: string;
}

export interface ActionPreferences {
    readonly publishLatestTag: boolean;
    readonly preferBranchRelease: boolean;
}

export const preferences: ActionPreferences = {
    publishLatestTag:
        (process.env.INPUT_PUBLISH_LATEST ?? process.env.INPUT_PUBLISH_LATEST_TAG).toLowerCase() === "true",
    preferBranchRelease: process.env.INPUT_PREFER_BRANCH_RELEASES.toLowerCase() === "true",
};

export interface GraphQlQueryRepository {
    refs: {
        refsList: {
            ref: {
                name: string
            }
        }[],
        pageInfo: {
            endCursor: string,
            hasNextPage: boolean
        },
        totalCount: number
    }
}

// Test the query at: https://docs.github.com/en/graphql/overview/explorer
export const queryAllRefs = `
query ($repoOwner: String!, $repoName: String!, $majorRef: String!, $pagination: String = "") {
  repository(name: $repoName, owner: $repoOwner) {
    refs(refPrefix: $majorRef, first: 100, after: $pagination, orderBy: {field: ALPHABETICAL, direction: DESC}) {
      refsList: edges {
        ref: node {
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
      totalCount
    }
  }
}`;
