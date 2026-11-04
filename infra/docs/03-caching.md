# 03 — Caching

## 1. What CI uses today (GitHub-hosted runners)

Every `ci.yml` job runs on a GitHub-hosted runner, so all caching is
**GitHub's actions/cache**. There is no self-hosted cache service in the loop.

| Cache | Key | Written by | Read by |
| --- | --- | --- | --- |
| Bazel action cache + CAS (the `--disk_cache` dir) and the repository cache (downloads + extracted repo contents) | `bazel-disk-v3-<scope>-<os>-<arch>-<config hash>-<source hash>` | `.github/actions/bazel-natives` save step, on `main` and only after an inexact restore; jobs that use `bazel-cache` directly restore without saving | every Bazel job, with prefix fallbacks |
| bun package store | `bun-<os>-<lockhash>` | `main` only (`bun-cache-warm.yml` seeds it) | all jobs |
| linux-x64 addon pair | `natives-linux-x64-v1-<native inputs hash>` | `main`'s `native_addons` | PR `native_addons` |
| Addons within a run | artifacts `natives-linux-x64`, `native-addons` (1 day) | `native_addons`, `native_addons_cross` | test and release jobs (`.github/actions/native-artifacts`) |

### Bazel cache (`bazel-cache` action)

[`.github/actions/bazel-cache`](../../.github/actions/bazel-cache/action.yml)
probes the environment, then emits a bazelrc fragment (`rc` output) for
`bazelisk --bazelrc=…`:

- **`BAZEL_REMOTE_USER` and `BAZEL_REMOTE_PASSWORD` unset** (the current case —
  no workflow sets them): `--config=ci`, `--disk_cache=$HOME/.cache/omp-bazel-disk`,
  `--repository_cache=$HOME/.cache/omp-bazel-repo`, restored through
  actions/cache (the save happens in `bazel-natives`, on `main` only).
- **Both set**: the cluster remote-cache branch —
  `--remote_cache=grpcs://bazel-remote.bazel-cache.svc.cluster.local:9092`,
  `--tls_certificate=infra/bazel-remote/ca.crt`,
  `--repository_cache=/opt/bazel-repo-cache`, `--remote_download_toplevel`.
  That service is the retired k3s/ARC stack documented in
  [`infra/bazel-remote/`](../bazel-remote/) and [README](README.md); nothing
  deploys it today, so this branch is inert but its `ca.crt` path is live and
  the file must stay in the tree.

`.bazelrc` carries the policies: `cache-rw` (upload local results) and `cache-ro`
(no uploads), both with `--remote_local_fallback`, 2 retries and a 60 s timeout,
so a cache outage degrades to local execution instead of failing the build.

### Cache scoping

actions/cache entries are scoped to the ref that saved them and count against
the repository's shared quota. The fork therefore saves only on `main`: a tag or
branch copy is readable by that ref alone while still evicting main's archives
(a tag-dispatched release once pushed main's darwin archive out of the quota and
sent every later darwin build cold). Every other ref restores main's archives.

## 2. Poisoning boundary

Pull request jobs restore but never save the shared archives, and the Bazel jobs
that write the addon cache are `if: github.event_name != 'pull_request'`. A PR
can only save Actions cache entries into its own `refs/pull/<n>/merge` scope.
`node_modules`, Cargo `target/` and Bazel outputs live and die inside each job's
runner.

## 3. Retired vmon cache model

While vmon served the trusted runs, caches came from the `omp-ci` template and
the vmon node instead: the sandbox forked a snapshot with the bun store, Cargo
registry, Bazel install/output base and `/opt/bazel-repo-cache` baked in, and the
node served the Actions cache (`VMON_CI=1`) plus a per-repository Bazel HTTP
cache at `$VMON_CACHE_URL/bazel` (`--config=cache-rw` for branch/tag jobs,
`--config=cache-ro` for pull requests). The kept actions still branch on
`VMON_CI`: `bun-install` reports `bun cache backend: omp-ci template store` and
`bazel-cache` keeps its template-baked repository-cache flags. With `VMON_CI`
unset — the current case — both fall back to actions/cache as described above.
See [01-vmon-runners.md](01-vmon-runners.md) and
[02-omp-ci-template.md](02-omp-ci-template.md).
