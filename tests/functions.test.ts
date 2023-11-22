import fs from 'node:fs';
import os from 'node:os';

import { getOctokit } from '@actions/github';
import type { GraphQlQueryRepository } from '@actionstagger/functions/types';

describe('Functions', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => jest.restoreAllMocks());

  describe.each([
    { preferbranchReleases: 'false', expected: 'tags' },
    { preferbranchReleases: 'true', expected: 'heads' },
  ])('#getPreferredRef()', ({ preferbranchReleases, expected }) => {
    test(`when INPUT_PREFER_BRANCH_RELEASES=${preferbranchReleases} returns ${expected}`, async () => {
      jest.replaceProperty(process, 'env', {
        INPUT_PREFER_BRANCH_RELEASES: preferbranchReleases,
      });
      await import('@actionstagger/functions/public').then(({ default: { getPreferredRef } }) =>
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
      await import('@actionstagger/functions/public').then(
        ({ default: { getPublishRefVersion } }) =>
          expect(getPublishRefVersion().version).toBe(expected)
      );
    });
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
      await import('@actionstagger/functions/public').then(
        ({ default: { getPublishRefVersion } }) =>
          expect(getPublishRefVersion().version).toBe(expected)
      );
    });
  });

  describe.each([
    {
      pushedRef: 'v3.2.2',
      existing: 'v3.3.0',
      repoLatest: 'v4.0.0',
      expected: ['4.0.0', '3.3.0'],
    },
    {
      pushedRef: 'v3.2.0',
      expected: ['3.2.0', '3.2.0'],
    },
    {
      pushedRef: 'v3.3.0',
      existing: 'v3.2.2',
      repoLatest: 'v4.0.0',
      expected: ['4.0.0', '3.3.0'],
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
      // to create semver objects such as SemVer is not instanceof SemVer...🙄
      // In short see https://backend.cafe/should-you-use-jest-as-a-testing-library
      const { default: semverParse } = await import('semver/functions/parse');
      const semverTag = semverParse(pushedRef)!;

      await import('@actionstagger/functions/public').then(functions => {
        jest.spyOn(functions.default, 'getPublishRefVersion').mockReturnValue(semverTag);
      });

      await import('@actionstagger/functions/private').then(functions => {
        jest.spyOn(functions.default, 'listAllRefs').mockImplementation(async function* () {
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
      const {
        default: { findLatestRef },
      } = await import('@actionstagger/functions/public');
      await findLatestRef(getOctokit('TEST_TOKEN')).then(({ repoLatest, majorLatest }) => {
        expect([repoLatest.name, majorLatest.name]).toEqual(expected);
      });
    });
  });

  describe.each([
    {
      refToCreate: 'v3.3.7',
      publishLatest: false,
      expectedRef: 'tags/v3',
    },
    {
      refToCreate: 'v3.3.1',
      publishLatest: true,
      expectedRef: 'tags/v3',
    },
  ])(
    '#createRequiredRefs(github, publishLatest)',
    ({ refToCreate, publishLatest, expectedRef }) => {
      beforeEach(async () => {
        const semverTag = (await import('semver/functions/parse')).default(refToCreate)!;
        await import('@actionstagger/functions/private').then(functions =>
          jest.spyOn(functions.default, 'createRef').mockResolvedValue()
        );

        await import('@actionstagger/functions/public').then(functions =>
          jest.spyOn(functions.default, 'getPublishRefVersion').mockReturnValue(semverTag)
        );

        await import('@actionstagger/functions/public').then(functions =>
          jest.spyOn(functions.default, 'getPreferredRef').mockReturnValue('tags')
        );
      });

      test(`when creating ref for ${refToCreate} and publishLatest=${publishLatest}, will create ${expectedRef} and${
        publishLatest ? '' : ' not'
      } publish latest tag`, async () => {
        await import('@actionstagger/functions/public').then(
          ({ default: { createRequiredRefs } }) =>
            createRequiredRefs(getOctokit('TEST_TOKEN'), publishLatest).then(({ ref, latest }) => {
              expect(ref).toBe(expectedRef);
              expect(latest).toBe(publishLatest);
            })
        );
      });
    }
  );
});
