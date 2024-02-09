enum ActionError {
  ACTION_CONTEXT_ERROR = 'This action should only be used in a release context or when creating/deleting a tag or branch',
  ACTION_SEMVER_ERROR = 'This action can only operate on semantically versioned refs\nSee: https://semver.org/',
  ACTION_OLDREF_ERROR = 'Nothing to do because ref id is earlier than major tag commit',
}

type ActionErrorObj = { [key in keyof typeof ActionError]: (typeof ActionError)[key] };
type ActionErrorRevObj = {
  [key in keyof typeof ActionError as ActionErrorObj[key]]: key;
};

export const ActionErrorMap = {
  ...ActionError,
  ...Object.keys(ActionError).reduce((acc, key: keyof typeof ActionError) => {
    (acc as any)[ActionError[key]] = key;
    return acc;
  }, {} as ActionErrorRevObj),
} as const;

export default ActionError;
