interface ActionPreferences {
  readonly publishLatest: boolean;
  readonly preferBranchRelease: boolean;
}

export const preferences: ActionPreferences = {
  publishLatest:
    // TODO v3: Ignore INPUT_PUBLISH_LATEST_TAG
    (process.env.INPUT_PUBLISH_LATEST ?? process.env.INPUT_PUBLISH_LATEST_TAG)?.toLowerCase() ===
    'true',
  preferBranchRelease: process.env.INPUT_PREFER_BRANCH_RELEASES?.toLowerCase() === 'true',
};

// Test the query at: https://docs.github.com/en/graphql/overview/explorer
export const queryAllRefs = `
query ($repoOwner: String!, $repoName: String!, $majorRef: String!, $pagination: String = "") {
  repository(name: $repoName, owner: $repoOwner) {
    refs(refPrefix: $majorRef, first: 100, after: $pagination, orderBy: {field: ALPHABETICAL, direction: DESC}) {
      refsList: edges {
        ref: node {
          name
          object: target {
            shaId: oid
          }
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
