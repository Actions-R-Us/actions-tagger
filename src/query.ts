export const queryCommitDateOfRef = `
    query majorCommitDate($majorVersion: String!, $repoName: String!, $repoOwner: String!, $majorRef: String!) {
        repository(name: $repoName, owner: $repoOwner) {
            refs(refPrefix: $majorRef, query: $majorVersion, first: 1) {
                nodes {
                    target {
                        ... on Commit {
                            committedDate
                        }
                    }
                }
            }
            object(expression: $tagCommit) {
                ... on Commit {
                    commitDate
                }
            }
        }
    }`;
