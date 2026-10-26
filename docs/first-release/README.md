# First release fixes

The first release should fix critical bugs and access problems, make grading and reports reliable, and make the system available for departmental use. [Epic #25](https://github.com/batuhanynr/GTU-ITS/issues/25) tracks the bugfix work. Deployment still needs a separate readiness check.

## Test evidence

- [Main retest report](main-retest-2026-10-25.docx): 101 checks, 83 passed and 18 failed.
- [Additional scenario report](extra-tests-2026-10-25.docx): 45 scenarios, 20 passed and 25 failed.

These reports describe main at `a8e647c`, before the fixes in this epic. Several scenarios cover the same problem. Two failures in the additional report need a product decision: changing the Staj 1 prerequisite after Staj 2 exists, and sending an empty report selection. The scenario counts are not counts of separate bugs. PR comments record the results after each fix.

## Ownership

Batuhan handles account access, password reset, safe internship writes, and commission limits. Tuana handles grading, reports, and the active internship rule. The epic contains assigned sub-issues and pass criteria for each change. The epic stays open until all required sub-issues and release checks pass.

## Deferred work

- Improve error messages for rejected files, oversized uploads, invalid IDs, and missing login fields.
- Reject duplicate conflicting grades in one request. The normal UI has not been shown to send this payload.
- Decide whether an empty report selection means no students or the whole term.
- Decide what happens to Staj 2 when an earlier passing Staj 1 grade is corrected to U.

## Delivery

1. Start one short `fix/`, `feat/`, or `chore/` branch for each issue.
2. Implement the change. Use one-line English comments where the reason is not clear from the code.
3. Run a focused regression test and record the actual result.
4. Commit and push. Keep separate commits when they help review the work. Do not add AI author or co-author trailers.
5. Open a PR linked to the issue. Write the explanation and test comment in simple English.
6. Review the diff and checks, then merge with a merge commit. Do not squash.
7. Continue with the next issue after the PR is merged.

GitHub does not allow authors to approve their own PRs. The repository requires a PR and has zero required approvals. A self-authored PR can be merged after review and testing, but that must not be described as an independent approval.

## Validation boundaries

Use a separate PostgreSQL database for tests that write data. Never seed or reset an existing departmental database to run a regression. The reports include API/database tests and React component tests; they do not establish live browser coverage or real email delivery.

## Review after Tuana changes

[The 26 October report](post-merge-review-2026-10-26.docx) checks main at `f7c770c` after PRs #49 through #56. All eight PRs were already merged with merge commits. The existing backend suite passed 12/12 and the committed database suite passed 27/27. Follow-up scenarios found remaining failures in #34, #38, and #39, so those issues were reopened. The epic remains open.

The report has 105 control rows: 95 passed and 10 failed. That includes 104 executed tests and the existing App suite that could not start. [Reproduction tests and results](evidence/2026-10-26/README.md) are stored with the report.

Migration `20261025150000_active_internship_unique` is required. Before applying it to an existing database, check for multiple active or passed internships of the same type for one student. Review those records if any exist; do not delete them automatically. The local upgrade found no duplicates, applied the migration after a backup, and preserved all 11 users, 13 students, and 16 internships. No new dependency is needed.
