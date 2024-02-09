export type GitHub = ReturnType<typeof import('@actions/github').getOctokit>;

export interface GraphQlQueryRepository {
  refs: {
    refsList: Array<{
      ref: {
        name: string;
        object: {
          shaId: string;
        };
      };
    }>;
    pageInfo: {
      endCursor: string;
      hasNextPage: boolean;
    };
    totalCount: number;
  };
}

export interface TaggedRef {
  ref: Ref;
  publishedLatest: boolean;
}

export interface MajorRef {
  majorLatest?: Ref; // may not exist if ref was deleted and was the only one
  isLatest: boolean;
}

export interface Ref {
  name: string;
  shaId: string;
}
