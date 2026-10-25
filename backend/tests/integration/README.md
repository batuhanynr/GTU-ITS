# Database regression tests

Use a separate local PostgreSQL database whose name starts with `gtu_` and ends with `test`. Apply the Prisma migrations to that empty test database first. The tests create their own fixtures and remove those fixtures afterward. They do not require seed data.

From the repository root:

```sh
TEST_DATABASE_URL=postgresql://test_user@127.0.0.1:5432/gtu_release_test node --test --test-concurrency=1 backend/tests/integration/*.test.js
```

The helper rejects a missing URL, a remote host, or a database name outside this test pattern. Never point it at a database containing departmental data.
