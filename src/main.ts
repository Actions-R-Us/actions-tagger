import semverEq from 'semver/functions/eq';
import semverGt from 'semver/functions/gt';

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import ActionError, { ActionErrorMap } from '@actionstagger/errors';
import {
  createRequiredRefs,
  findLatestMajorRef,
  getPublishRefVersion,
  isEditedRelease,
  isPublicRefDelete,
  isPublicRefPush,
  isPublishedRelease,
  isSemVersionedRef,
  unlinkLatestRefMatch,
} from '@actionstagger/functions';
import type { GitHub, Ref } from '@actionstagger/functions/types';

export default async function main(): Promise<void> {
  if (!(isPublicRefPush() || isPublicRefDelete() || isPublishedRelease() || isEditedRelease())) {
    presentError(ActionError.ACTION_CONTEXT_ERROR);
    return;
  }

  if (!isSemVersionedRef()) {
    presentError(ActionError.ACTION_SEMVER_ERROR);
    return;
  }

  const octokit = createOctoKit();
  const { isLatest, majorLatest } = await findLatestMajorRef(octokit);
  const releaseVer = getPublishRefVersion()!;

  if (majorLatest === undefined) {
    // major tag doesn't exist. It was possibly deleted...
    // this can also occur if the deleted tag was the only tag with that major version
    await unlinkLatestRefMatch(octokit);
    return;
  }

  let ref: Ref;
  let publishedLatest: boolean = false;

  if (semverGt(releaseVer, majorLatest.name)) {
    // this implies that releaseVer was deleted. publish just new major tag
    ({ ref, publishedLatest } = await createRequiredRefs(octokit, majorLatest, isLatest));
    // and delete the latest tag if it was pointing to the deleted release
    await unlinkLatestRefMatch(octokit);
  } else if (semverEq(releaseVer, majorLatest.name)) {
    // publish the latest tag
    ({ ref, publishedLatest } = await createRequiredRefs(
      octokit,
      {
        name: releaseVer.version,
        shaId: process.env.GITHUB_SHA!,
      },
      isLatest
    ));
  } else {
    presentError(ActionError.ACTION_OLDREF_ERROR);
    return;
  }

  outputTagName(ref);
  outputLatest(publishedLatest);
}

/**
 * Sets the output of this action to indicate the version that was published/updated
 * @param ref The newly created version
 */
function outputTagName(ref: Ref): void {
  core.setOutput('tag', ref.name);
  // TODO: Deprecate: v3
  core.setOutput('ref_name', ref.name);
}

/**
 * Sets the output of this action to indicate if the latest tag was published
 * @param isLatest
 */
function outputLatest(isLatest: boolean): void {
  core.setOutput('latest', isLatest.toString());
}

function createOctoKit(): GitHub {
  let token = core.getInput('token');
  if (token === '' && process.env.GITHUB_TOKEN != null) {
    // TODO: Deprecate: v3
    core.info(
      `Using obsolete GITHUB_TOKEN environment variable: Please use token
                |arg instead. In most cases the default value will just work and you can
                |simply remove the token variable from your configuration.`.replace(/^\s*\|/gm, '')
    );
    token = process.env.GITHUB_TOKEN;
  }
  return getOctokit(token);
}

function presentError(actionError: ActionError): void {
  // only throw errors during tests
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null) {
    const error = new Error(actionError);
    error.name = ActionErrorMap[actionError];
    throw error;
  }
  core.info(actionError);
  core.info('If you believe this to be a false positive, please submit a bug report');
  core.info(
    `https://github.com/${
      process.env.GITHUB_ACTION_REPOSITORY ?? 'Actions-R-Us/actions-tagger'
    }/issues`
  );

  if (core.isDebug()) {
    core.debug(`event: ${process.env.GITHUB_EVENT_NAME ?? 'unknown'}`);
    core.debug(`ref_name: ${getPublishRefVersion()?.raw}`);
  }
}
