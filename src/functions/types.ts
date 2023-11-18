export type GitHub = ReturnType<typeof import('@actions/github').getOctokit>;

export interface GraphQlQueryRepository {
    refs: {
        refsList: {
            ref: {
                name: string;
                object: {
                    shaId: string;
                };
            };
        }[];
        pageInfo: {
            endCursor: string;
            hasNextPage: boolean;
        };
        totalCount: number;
    };
}

export interface TaggedRef {
    ref: Ref['name'];
    latest: boolean;
}

export interface LatestRef {
    repoLatest: Ref;
    majorLatest: Ref;
}

export interface Ref {
    name: string;
    shaId: string;
}
