import * as core from '@actions/core';
import main from '@actionstagger/main';

main().catch((error: Error) => {
  core.setFailed(error.message);
});
