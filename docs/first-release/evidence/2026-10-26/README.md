# Review scenarios from 26 October 2026

These scenarios check main at `f7c770c` after PRs #49 through #56. The existing backend tests pass 12/12 and committed database tests pass 27/27. The extra UI checks pass 29/35; the extra API checks pass 2/5. The existing frontend has 25 passing tests and one App suite that cannot start because react-router-dom is not resolved.

`results.json` contains the 105 report rows: 95 passed and 10 failed. This includes the failed App suite as one setup check. There are 104 executed tests, with 95 passes and 9 failures. Several failures cover the same issue in both roles.

Issues #34, #38, and #39 were reopened. These test files preserve the failures for the next fixes; they are kept outside the normal test directories so a report-only change does not alter the default suite.

## Run the extra checks

Use a disposable checkout and a separate local database. Follow backend/tests/integration/README.md to migrate a local `gtu_*test` database. No seed is required.

Copy `api-followup.test.js` to `backend/tests/integration/review-followup.test.js`, then run:

```sh
TEST_DATABASE_URL=<isolated local test database> node --test backend/tests/integration/review-followup.test.js
```

Copy `review-tuana.test.js`, `review-edge.test.js`, and `review-followup.test.js` to `frontend-new/src/tests`, then run from frontend-new:

```sh
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/tests/review-tuana.test.js src/tests/review-edge.test.js src/tests/review-followup.test.js
```

The UI checks control response delays and errors with mocks. They do not replace live browser testing. The single-grade race is timing dependent; the recorded run accepted both writes in 9 of 10 trials. The original report keeps that observation even if a later run produces a different count.
