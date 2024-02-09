import SemVer from 'semver/classes/semver';
import semverParse from 'semver/functions/parse';

import * as core from '@actions/core';
import { context } from '@actions/github';
import { preferences, queryAllRefs } from '@actionstagger/util';

import type { GitHub, GraphQlQueryRepository, Ref } from './types';

/* eslint-disable @typescript-eslint/no-namespace */
namespace Functions.Private {
  function isSemVerPrelease(semv: SemVer | null): boolean {
    return (semv?.prerelease.length ?? 0) + (semv?.build.length ?? 0) > 0;
  }
  /**
   * Checks if the event that triggered this action was a release
   * See: https://docs.github.com/en/webhooks/webhook-events-and-payloads#release
   */
  export function isRelease(): boolean {
    return context.eventName === 'release';
  }

  /**
   * Checks if the event that triggered this action was a push
   * See: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
   */
  export function isPush(): boolean {
    return context.eventName === 'push';
  }

  /**
   * @returns true if the event that triggered this action deleted a ref
   */
  export function isDeletedPushRef(): boolean {
    return Private.isPush() && context.payload.deleted;
  }

  /**
   * @returns true if the event that triggered this action created a ref
   */
  export function isCreatedPushRef(): boolean {
    return Private.isPush() && context.payload.created;
  }

  /**
   * TODO v3: Remove this check because we should not be running for prereleases
   * Check if the event that triggered this actions was as a result
   * of a prerelease or not
   *
   * For some reason, it is not enough to check if the action is
   * prereleased of type, because even prereleases have the action of "published"
   * See: https://github.com/orgs/community/discussions/26281
   * See also: https://docs.github.com/en/webhooks/webhook-events-and-payloads#release
   */
  export function isPreRelease(): boolean {
    return context.payload.release?.prerelease === true;
  }

  /**
   * @returns true if the tag is a prerelease
   */
  export function isPreReleaseRef(): boolean {
    return isSemVerPrelease(Private.getPushRefVersion());
  }

  /**
   * Is a release available to the public?
   * A pre-release is usually considered "not ready" for public use
   */
  export function isPublicRelease(): boolean {
    return Private.isRelease() && !Private.isPreRelease();
  }

  /**
   * @returns true if the event is a branch push
   */
  export function isRefHeads(): boolean {
    return context.payload.ref?.startsWith('refs/heads/');
  }

  /**
   * @returns true if the event is a tag push
   */
  export function isRefTags(): boolean {
    return context.payload.ref?.startsWith('refs/tags/');
  }

  /**
   * @returns true if the event is a branch push
   */
  export function isBranchPush(): boolean {
    return Private.isCreatedPushRef() && Private.isRefHeads();
  }

  /**
   * @returns true if the event is a tag push
   */
  export function isTagPush(): boolean {
    return Private.isCreatedPushRef() && Private.isRefTags();
  }

  /**
   * @returns true if the event is a branch delete
   */
  export function isBranchDelete(): boolean {
    return Private.isDeletedPushRef() && Private.isRefHeads();
  }

  /**
   * @returns true if the event is a tag push
   */
  export function isTagDelete(): boolean {
    return Private.isDeletedPushRef() && Private.isRefTags();
  }

  /**
   * Check if this event was a new tag push
   */
  export function isRefPush(): boolean {
    return Private.isBranchPush() || Private.isTagPush();
  }

  /**
   * @returns true if the event is a tag or branch delete
   */
  export function isRefDelete(): boolean {
    return Private.isBranchDelete() || Private.isTagDelete();
  }

  /**
   * Creates the given ref for this release
   * refName must begin with tags/ or heads/
   *
   * @param github The github client
   * @param ref The ref to use. ex tags/latest, heads/v1, etc
   */
  export async function createRef(github: GitHub, ref: Ref): Promise<void> {
    const { name: refName, shaId: refSha } = ref;
    const { data: matchingRefs } = await github.rest.git.listMatchingRefs({
      ...context.repo,
      ref: refName,
    });

    const matchingRef = matchingRefs.find((refObj: { ref: string }) => {
      return refObj.ref.endsWith(refName);
    });

    let upstreamRef: Awaited<ReturnType<typeof github.rest.git.createRef>>['data'];

    if (matchingRef !== undefined) {
      core.info(`Updating ref: ${refName} to: ${refSha}`);
      ({ data: upstreamRef } = await github.rest.git.updateRef({
        ...context.repo,
        force: true,
        ref: refName,
        sha: refSha,
      }));
    } else {
      core.info(`Creating ref: refs/${refName} for: ${refSha}`);
      ({ data: upstreamRef } = await github.rest.git.createRef({
        ...context.repo,
        ref: `refs/${refName}`,
        sha: refSha,
      }));
    }

    if (core.isDebug()) {
      core.debug(`response: ${JSON.stringify(upstreamRef)}`);
      core.debug(`${upstreamRef?.ref} now points to: "${refSha}"`);
    }
  }

  /**
   * finds the latest ref if it points to the deleted release
   * there should technically only be one
   * @param github The github octokit client
   * @param ref The ref which was deleted
   */
  export async function* listLatestRefMatches(github: GitHub, ref: Ref) {
    const { data: matchingRefs } = await github.rest.git.listMatchingRefs({
      ...context.repo,
      // TODO v3: `${getPreferredRef()}/latest`
      ref: `tags/latest`,
    });

    for (const matchRef of matchingRefs) {
      if (matchRef.object.sha === ref.shaId) {
        if (core.isDebug()) {
          core.debug(`Found latest ref: ${matchRef.ref}`);
        } else {
          yield matchRef.ref;
        }
      }
    }
  }

  /**
   * List all the refs in the repository based on user's preferred ref
   *
   * @param github The github client
   */
  export async function* listAllPublicRefs(github: GitHub) {
    for (let nextPage = ''; true; ) {
      const { repository }: { repository: GraphQlQueryRepository } = await github.graphql(
        queryAllRefs,
        {
          repoName: context.repo.repo,
          repoOwner: context.repo.owner,
          majorRef: `refs/${Private.getPreferredRef()}/`,
          pagination: nextPage,
        }
      );

      for (const { ref } of repository.refs.refsList) {
        const semverRef = semverParse(ref.name);
        if (semverRef !== null && !isSemVerPrelease(semverRef)) {
          if (core.isDebug()) {
            core.debug(`checking ${ref.name}`);
          }
          yield [semverRef, ref.object.shaId] as const;
        } else if (core.isDebug()) {
          core.debug(`ignoring ${ref.name}`);
        }
      }

      if (repository.refs.pageInfo.hasNextPage) {
        nextPage = repository.refs.pageInfo.endCursor;
      } else {
        break;
      }
    }
  }

  /**
   * Get the ref version for the current push
   *
   * @returns the ref for this release (if any)
   */
  export function getPushRefVersion() {
    const refName: string = (context.payload.ref as string)?.replace(
      new RegExp(`^refs/${Private.getPreferredRef()}/`),
      ''
    );
    return semverParse(refName);
  }

  /**
   * Get the actual tag version for this release. It also takes into account
   * whether or not this is a prerelease
   *
   * @returns the tag for this release (if any)
   */
  export function getReleaseTag() {
    const tagName: string = context.payload.release?.tag_name;
    return semverParse(tagName);
  }

  /**
   * Returns the appropriate ref depending on the input preferences
   */
  export function getPreferredRef() {
    return preferences.preferBranchRelease ? 'heads' : 'tags';
  }
}

export default Functions.Private;
