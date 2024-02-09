import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

import { getOctokit } from '@actions/github';
import type { GraphQlQueryRepository } from '@actionstagger/functions/types';

describe('Functions', () => {
  describe.each([
    { preferbranchReleases: 'false', expected: 'tags' },
    { preferbranchReleases: 'true', expected: 'heads' },
  ])('#getPreferredRef()', ({ preferbranchReleases, expected }) => {
    test(`when INPUT_PREFER_BRANCH_RELEASES=${preferbranchReleases} returns ${expected}`, async () => {
      jest.replaceProperty(process, 'env', {
        INPUT_PREFER_BRANCH_RELEASES: preferbranchReleases,
      });
      await import('@actionstagger/functions/private').then(({ default: { getPreferredRef } }) =>
        expect(getPreferredRef()).toBe(expected)
      );
    });
  });

  describe.each([
    {
      eventName: 'push',
      preferbranchReleases: 'false',
      githubRef: 'refs/tags/v3.0.0',
      expected: '3.0.0',
    },
    {
      eventName: 'push',
      preferbranchReleases: 'true',
      githubRef: 'refs/heads/v2.3.0',
      expected: '2.3.0',
    },
  ])('#getPublishRefVersion()', ({ eventName, preferbranchReleases, githubRef, expected }) => {
    const dir = fs.mkdtempSync(os.tmpdir() + '/jest-push');

    beforeEach(() => {
      const pushEvent = {
        ref: `${githubRef}`,
        created: true,
      };
      fs.writeFileSync(`${dir}/event.json`, JSON.stringify(pushEvent));
      jest.replaceProperty(process, 'env', {
        GITHUB_EVENT_PATH: `${dir}/event.json`,
        INPUT_PREFER_BRANCH_RELEASES: preferbranchReleases,
        GITHUB_EVENT_NAME: eventName,
        GITHUB_REF_NAME: githubRef.replace(/refs\/.+\//g, ''),
        GITHUB_REF: githubRef,
      });
    });

    afterEach(() => {
      fs.readdirSync(dir, { recursive: true }).forEach(file => {
        fs.rmSync(`${dir}/${file}`);
      });
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true });
    });

    test(`on ${eventName} when INPUT_PREFER_BRANCH_RELEASES=${preferbranchReleases}, pushed ref=${githubRef}, returns=${expected}`, async () => {
      await import('@actionstagger/functions').then(({ getPublishRefVersion }) =>
        expect(getPublishRefVersion()!.version).toBe(expected)
      );
    });
  });

  describe.each([
    {
      tagName: '10.20.30',
      expected: true,
    },
    {
      tagName: '1.1.2-prerelease+meta',
      expected: false,
    },
    {
      tagName: '1.0.0-alpha.1',
      expected: false,
    },
    {
      tagName: 'v1.1.7',
      expected: true,
    },
    {
      tagName: '2023.01.01',
      expected: true,
    },
    {
      tagName: '2.0.0-rc.1+build.123',
      expected: false,
    },
    {
      // although not valid semver, it does not contain prerelease or build fields
      tagName: '1.2',
      expected: true,
    },
    {
      // although not valid semver, it does not contain prerelease or build fields
      tagName: 'v1',
      expected: true,
    },
  ])('#isPublicRefPush()', ({ tagName, expected }) => {
    const dir = fs.mkdtempSync(os.tmpdir() + '/jest-push');

    beforeEach(() => {
      const pushEvent = {
        ref: `refs/tags/${tagName}`,
        created: true,
      };
      fs.writeFileSync(`${dir}/event.json`, JSON.stringify(pushEvent));
      jest.replaceProperty(process, 'env', {
        GITHUB_EVENT_PATH: `${dir}/event.json`,
        INPUT_PREFER_BRANCH_RELEASES: 'false',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF_NAME: tagName,
        GITHUB_REF: `refs/tags/${tagName}`,
      });
    });

    afterEach(() => {
      fs.readdirSync(dir, { recursive: true }).forEach(file => {
        fs.rmSync(`${dir}/${file}`);
      });
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true });
    });

    test(`when pushed ref=${tagName}, returns ${expected}`, async () =>
      await import('@actionstagger/functions').then(({ isPublicRefPush }) =>
        expect(isPublicRefPush()).toBe(expected)
      ));
  });

  describe.each([
    {
      eventName: 'release',
      tagName: 'v3.0.0',
      expected: '3.0.0',
    },
    {
      eventName: 'release',
      tagName: 'v2.3.0',
      expected: '2.3.0',
    },
  ])('#getPublishRefVersion()', ({ eventName, tagName, expected }) => {
    const dir = fs.mkdtempSync(os.tmpdir() + '/jest-release');

    beforeEach(() => {
      const releaseEvent = {
        release: {
          tag_name: `${tagName}`,
        },
      };
      fs.writeFileSync(`${dir}/event.json`, JSON.stringify(releaseEvent));
      jest.replaceProperty(process, 'env', {
        GITHUB_EVENT_PATH: `${dir}/event.json`,
        GITHUB_EVENT_NAME: eventName,
      });
    });

    afterEach(() => {
      fs.readdirSync(dir, { recursive: true }).forEach(file => {
        fs.rmSync(`${dir}/${file}`);
      });
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true });
    });

    test(`on ${eventName}, release tag=${tagName}, returns=${expected}`, async () => {
      await import('@actionstagger/functions').then(({ getPublishRefVersion }) =>
        expect(getPublishRefVersion()!.version).toBe(expected)
      );
    });
  });

  describe.each([
    { eventName: 'release', action: 'published', expected: true },
    { eventName: 'release', action: 'edited', expected: false },
  ])('#isPublishedRelease()', ({ eventName, action, expected }) => {
    const dir = fs.mkdtempSync(os.tmpdir() + '/jest-release');

    beforeEach(() => {
      const releaseEvent = {
        action,
        release: {
          tag_name: 'v3.0.0',
        },
      };
      fs.writeFileSync(`${dir}/event.json`, JSON.stringify(releaseEvent));
      jest.replaceProperty(process, 'env', {
        GITHUB_EVENT_PATH: `${dir}/event.json`,
        GITHUB_EVENT_NAME: eventName,
      });
    });

    test('Should have been set to true', async () =>
      await import('@actionstagger/functions').then(({ isPublishedRelease }) =>
        expect(isPublishedRelease()).toBe(expected)
      ));
  });

  describe.each([
    {
      pushedRef: 'v3.2.2',
      existing: 'v3.3.0',
      repoLatest: 'v4.0.0',
      expected: [false, '3.3.0'],
    },
    {
      pushedRef: 'v3.2.0',
      expected: [true, '3.2.0'],
    },
    {
      pushedRef: 'v3.3.0',
      existing: 'v3.2.2',
      repoLatest: 'v4.0.0',
      expected: [false, '3.3.0'],
    },
  ])('#findLatestRef(github)', ({ pushedRef, existing, repoLatest, expected }) => {
    beforeEach(async () => {
      const refsList: GraphQlQueryRepository['refs']['refsList'] = [existing, repoLatest]
        .filter((ref): ref is string => Boolean(ref))
        .map((version, i) => ({
          ref: {
            name: version,
            object: {
              shaId: `${i + 1}`,
            },
          },
        }));
      // We need to import it here because jest mucks with the global scope which creates issues
      // when trying to use `instanceof`.
      // In this case, if the parse function was imported earlier, it will exist in a different
      // global scope than the rest of the test. Which leads to infruiating errors when used
      // to create semver objects. Errors such as 'SemVer is not instanceof SemVer' arise...🙄
      // In short see https://backend.cafe/should-you-use-jest-as-a-testing-library
      const { default: semverParse } = await import('semver/functions/parse');
      const semverTag = semverParse(pushedRef);

      await import('@actionstagger/functions').then(functions => {
        jest.spyOn(functions.default, 'getPublishRefVersion').mockReturnValue(semverTag);
      });

      await import('@actionstagger/functions/private').then(functions => {
        jest.spyOn(functions.default, 'listAllPublicRefs').mockImplementation(async function* () {
          for (const ref of refsList.map(
            ({ ref }) => [semverParse(ref.name)!, ref.object.shaId] as const
          )) {
            yield ref;
          }
        });
      });
    });

    test(`when new release or push of ${pushedRef}, and ref with name ${
      existing ?? 'unknown'
    } exists and latest ref is ${repoLatest ?? 'unknown'}, returns [${expected.join(
      ', '
    )}]`, async () => {
      const { findLatestMajorRef } = await import('@actionstagger/functions');
      await findLatestMajorRef(getOctokit('TEST_TOKEN')).then(({ isLatest, majorLatest }) => {
        expect([isLatest, majorLatest!.name] as const).toEqual(expected);
      });
    });
  });

  describe.each([
    { ref: 'v1.0.0.alpha', valid: false },
    { ref: 'v1.2', valid: false },
    { ref: '1.2.3-0123', valid: false },
    { ref: '10.20.30', valid: true },
    { ref: '10.20.30-rc1', valid: true },
    { ref: '2022.01.01', valid: false },
    { ref: 'v3.2.2', valid: true },
    { ref: '3.2.2-alpha', valid: true },
  ])('#isSemVersionedRef()', ({ ref, valid }) => {
    beforeEach(async () => {
      const { default: semverParse } = await import('semver/functions/parse');
      await import('@actionstagger/functions/public').then(({ default: functions }) => {
        jest.spyOn(functions, 'getPublishRefVersion').mockReturnValue(semverParse(ref));
      });
    });

    test(`ref ${ref} is ${valid ? 'valid' : 'invalid'} semver`, async () => {
      const { isSemVersionedRef } = await import('@actionstagger/functions');
      expect(isSemVersionedRef()).toBe(valid);
    });
  });

  describe.each([
    {
      refToCreate: 'v3.3.7',
      isLatest: false,
      expectedRef: 'tags/v3',
    },
    {
      refToCreate: 'v3.3.1',
      isLatest: true,
      expectedRef: 'tags/v3',
    },
  ])(
    '#createRequiredRefs(github, refToCreate, isLatest)',
    ({ refToCreate, isLatest, expectedRef }) => {
      beforeEach(async () => {
        jest.replaceProperty(process, 'env', {
          GITHUB_SHA: createHash('sha1').update(refToCreate).digest('hex'),
          INPUT_PUBLISH_LATEST: isLatest ? 'true' : 'false',
        });
        const semverTag = (await import('semver/functions/parse')).default(refToCreate);
        await import('@actionstagger/functions/private').then(functions =>
          jest.spyOn(functions.default, 'createRef').mockResolvedValue()
        );

        await import('@actionstagger/functions').then(functions =>
          jest.spyOn(functions.default, 'getPublishRefVersion').mockReturnValue(semverTag)
        );

        await import('@actionstagger/functions/private').then(functions =>
          jest.spyOn(functions.default, 'getPreferredRef').mockReturnValue('tags')
        );
      });

      test(`when creating ref for ${refToCreate} and isLatest=${isLatest}, will create ${expectedRef} and${
        isLatest ? '' : ' not'
      } publish latest tag`, async () => {
        await import('@actionstagger/functions').then(({ createRequiredRefs }) =>
          createRequiredRefs(
            getOctokit('TEST_TOKEN'),
            { name: refToCreate, shaId: process.env.GITHUB_SHA! },
            isLatest
          ).then(({ ref, publishedLatest }) => {
            expect(ref.name).toBe(expectedRef);
            expect(publishedLatest).toBe(isLatest);
          })
        );
      });
    }
  );
});

// TODO test unlinkLatestRefMatch
