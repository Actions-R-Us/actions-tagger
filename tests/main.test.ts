import ActionError from '@actionstagger/errors';

test('Action does not run if event is not public push or release', async () => {
  await import('@actionstagger/functions/public').then(({ default: functions }) => {
    jest.spyOn(functions, 'isPublicRefDelete').mockReturnValue(false);
    jest.spyOn(functions, 'isPublicRefPush').mockReturnValue(false);
    jest.spyOn(functions, 'isPublishedRelease').mockReturnValue(false);
    jest.spyOn(functions, 'isEditedRelease').mockReturnValue(false);
  });

  await import('@actionstagger/main').then(async ({ default: main }) => {
    await expect(main()).rejects.toThrow(ActionError.ACTION_CONTEXT_ERROR);
  });
});

test('Action does not run if ref does not match semver', async () => {
  await import('@actionstagger/functions/public').then(({ default: functions }) => {
    jest.spyOn(functions, 'isPublicRefPush').mockReturnValue(true);
    jest.spyOn(functions, 'isSemVersionedRef').mockReturnValue(false);
  });
  await import('@actionstagger/main').then(async ({ default: main }) => {
    await expect(main()).rejects.toThrow(ActionError.ACTION_SEMVER_ERROR);
  });
});

// TODO: test ActionError.ACTION_OLDREF_ERROR
