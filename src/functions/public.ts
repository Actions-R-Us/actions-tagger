import SemVer from 'semver/classes/semver';
import semverGt from 'semver/functions/gt';
import major from 'semver/functions/major';
import valid from 'semver/functions/valid';

import { context } from '@actions/github';
import Private from '@actionstagger/functions/private';
import { preferences } from '@actionstagger/util';

import type { GitHub, LatestRef, TaggedRef } from './types';

/* eslint-disable @typescript-eslint/no-namespace */
namespace Functions {
  /**
   * Check if this release is publically available and has been published
   */
  export function isPublishedRelease(): boolean {
    return Private.isPublicRelease() && context.payload.action === 'published';
  }

  /**
   * Check if this release is publically available and has been edited
   */
  export function isEditedRelease(): boolean {
    return Private.isPublicRelease() && context.payload.action === 'edited';
  }

  /**
   * Check if this event was a new tag push
   */
  export function isRefPush(): boolean {
    return Private.isBranchPush() || Private.isTagPush();
  }

  /**
   * Get the tag version being published via push or release event
   *
   * @returns The tag being published
   */
  export function getPublishRefVersion(): SemVer {
    return Functions.isRefPush()
      ? Private.getPushRefVersion(Functions.getPreferredRef())
      : Private.getReleaseTag();
  }

  /**
   * Checks if the tag version of the pushed tag/release has valid version
   */
  export function isSemVersionedTag(): boolean {
    return valid(Functions.getPublishRefVersion()) !== null;
  }

  /**
   * Get the major number of the release tag
   */
  export function majorVersion(): number {
    return major(Functions.getPublishRefVersion());
  }

  /**
   * Returns the appropriate ref depending on the input preferences
   */
  export function getPreferredRef(): 'heads' | 'tags' {
    return preferences.preferBranchRelease ? 'heads' : 'tags';
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
   * targetting a lower version than the latest v3 (v3.3.0) and we already have a latest version
   * which is v4.0.3
   *
   * @param {GitHub} github The octokit client instance
   */
  export async function findLatestRef(github: GitHub): Promise<LatestRef> {
    let [majorLatest, majorSha] = [Functions.getPublishRefVersion(), process.env.GITHUB_SHA];
    let [repoLatest, repoSha] = [majorLatest, majorSha];

    const major = majorLatest.major;
    for await (const [semverRef, shaId] of Private.listAllRefs(
      github,
      Functions.getPreferredRef()
    )) {
      if (semverRef.major === major && semverGt(semverRef, majorLatest)) {
        [majorLatest, majorSha] = [semverRef, shaId];
      }

      if (semverGt(semverRef, repoLatest)) {
        [repoLatest, repoSha] = [semverRef, shaId];
      }
    }
    return {
      repoLatest: { name: repoLatest.version, shaId: repoSha },
      majorLatest: { name: majorLatest.version, shaId: majorSha },
    };
  }

  /**
   * Creates the tags required and optionally a 'latest' tag
   *
   * @param {GitHub} github The octokit client for making requests
   * @param {Boolean} overridePublishLatest Flag used to force the publishing of the latest tag
   */
  export async function createRequiredRefs(
    github: GitHub,
    overridePublishLatest?: boolean
  ): Promise<TaggedRef> {
    const mayor = Functions.majorVersion();

    const ref = `${Functions.getPreferredRef()}/v${mayor}`;
    await Private.createRef(github, ref);

    const publishLatest: boolean = overridePublishLatest ?? preferences.publishLatest;
    if (publishLatest) {
      // TODO v3: `${getPreferredRef()}/latest`
      await Private.createRef(github, 'tags/latest');
    }

    return {
      ref,
      latest: publishLatest,
    };
  }
}

export default Functions;
