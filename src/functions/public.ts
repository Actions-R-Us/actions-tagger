import semverGt from 'semver/functions/gt';
import semverMajor from 'semver/functions/major';
import semverValid from 'semver/functions/valid';

import { context } from '@actions/github';
import Private from '@actionstagger/functions/private';
import { preferences } from '@actionstagger/util';

import type { GitHub, MajorRef, Ref, TaggedRef } from './types';

/* eslint-disable @typescript-eslint/no-namespace */
namespace Functions {
  /**
   * Check if this release is publically available and has been published
   */
  export function isPublishedRelease(): boolean {
    return (
      Private.isPublicRelease() &&
      // TODO v3: Only check for context.payload.action === 'released'
      (context.payload.action === 'published' || context.payload.action === 'released')
    );
  }

  /**
   * Check if this release is publically available and has been edited
   */
  export function isEditedRelease(): boolean {
    return Private.isPublicRelease() && context.payload.action === 'edited';
  }

  /**
   * Check if this event was a new ref push without a prerelease
   */
  export function isPublicRefPush(): boolean {
    return Private.isRefPush() && !Private.isPreReleaseRef();
  }

  /**
   * Check if this event was a ref delete without a prerelease
   */
  export function isPublicRefDelete(): boolean {
    return Private.isRefDelete() && !Private.isPreReleaseRef();
  }

  /**
   * Get the tag version being published via push or release event
   *
   * @returns The tag being published
   */
  export function getPublishRefVersion() {
    return Private.isRefPush() || Private.isRefDelete()
      ? Private.getPushRefVersion()
      : Private.getReleaseTag();
  }

  /**
   * Checks if the tag version of the pushed tag/release has valid version
   */
  export function isSemVersionedRef(): boolean {
    return semverValid(Functions.getPublishRefVersion()) !== null;
  }

  /**
   * Get the major number of the release tag
   */
  export function majorVersion(): number {
    return semverMajor(Functions.getPublishRefVersion()!);
  }

  /**
   * Finds the latest refs in the repository as well as the latest ref
   * for this event's major version. We do this to determine if we should proceed
   * with promoting the major and latest refs.
   *
   * e.g. if the current ref which triggered this actions is tagged v3.2.2,
   * but the latest ref is v4.0.3, a possible return value may be
   * {repoLatest: "v4.0.3", majorLatest: "v3.3.0"} (this is not a typo, keep reading).
   * In this case, this event should not trigger an update because it is
   * targetting a lower version than the latest v3 (v3.3.0) and we already have a latest version which is v4.0.3
   *
   * @param {GitHub} github The octokit client instance
   */
  export async function findLatestMajorRef(github: GitHub): Promise<MajorRef> {
    let [majorLatest, majorSha] = [Functions.getPublishRefVersion(), process.env.GITHUB_SHA!];
    let repoLatest = majorLatest;

    const major = majorLatest?.major;
    if (Private.isRefDelete()) {
      [majorLatest, majorSha] = [repoLatest] = [null, ''];
    }
    for await (const [semverRef, shaId] of Private.listAllPublicRefs(github)) {
      if (semverRef.major === major && (majorLatest === null || semverGt(semverRef, majorLatest))) {
        [majorLatest, majorSha] = [semverRef, shaId];
      }

      if (repoLatest === null || semverGt(semverRef, repoLatest)) {
        repoLatest = semverRef;
      }
    }

    return {
      isLatest: repoLatest?.compare(majorLatest!) === 0,
      majorLatest: majorLatest ? { name: majorLatest.version, shaId: majorSha } : undefined,
    };
  }

  /**
   * Creates the refs required and optionally a 'latest' ref
   *
   * @param {GitHub} github The octokit client for making requests
   * @param {Ref} majorRef The name of the major ref
   * @param {boolean} isLatest This ref is the latest
   */
  export async function createRequiredRefs(
    github: GitHub,
    majorRef: Ref,
    isLatest: boolean = false
  ): Promise<TaggedRef> {
    const major = semverMajor(majorRef.name);

    const ref: Ref = {
      name: `${Private.getPreferredRef()}/v${major}`,
      shaId: majorRef.shaId,
    };

    await Private.createRef(github, ref);

    if (preferences.publishLatest && isLatest) {
      // TODO v3: `${getPreferredRef()}/latest`
      await Private.createRef(github, {
        name: 'tags/latest',
        shaId: majorRef.shaId,
      });
    }

    return {
      ref,
      publishedLatest: preferences.publishLatest && isLatest,
    };
  }

  /**
   * Deletes the latest ref if it points to the deleted release
   * @param github The github octokit client
   * @param ref The ref that was deleted
   */
  export async function unlinkLatestRefMatch(github: GitHub): Promise<void> {
    const ref: Ref = {
      name: `${Private.getPreferredRef()}/v${Functions.majorVersion()}`,
      shaId: process.env.GITHUB_SHA!,
    };
    for await (const matchRef of Private.listLatestRefMatches(github, ref)) {
      await github.rest.git.deleteRef({
        ...context.repo,
        ref: matchRef,
      });
    }
  }
}

export default Functions;
