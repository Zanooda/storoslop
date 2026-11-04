# `infra/` — CI infrastructure

## What CI runs today

`.github/workflows/ci.yml` uses **GitHub-hosted runners only**. None of its 19 jobs
uses a self-hosted label: 16 declare `runs-on: ubuntu-22.04`, the `release_binary`
and `release_binary_hosted` matrices add `ubuntu-24.04-arm`, `macos-14`,
`macos-15-intel` and `windows-11-arm`, and `release_github_verify` runs on `macos-14`
(`bun-cache-warm.yml` and `nix.yml` are hosted as well).
`.github/actionlint.yaml` therefore registers no self-hosted label.

Caching is GitHub's actions/cache, composed by the fork's cache actions:

| Cache | Composed by | Saved by |
| --- | --- | --- |
| Bazel disk cache (`~/.cache/omp-bazel-disk`) + repository cache (`~/.cache/omp-bazel-repo`) | `.github/actions/bazel-cache` (`bazel-disk-v3-<scope>-…` key) | `.github/actions/bazel-natives` save step, `main` only |
| bun package store (`~/.bun/install/cache`) | `.github/actions/bun-install` (`bun-<os>-<lockhash>` key) | `main` only, seeded by `bun-cache-warm.yml` |

## Retired self-hosted paths

Two self-hosted designs are still in the tree but no workflow selects them:

| Path | What it is | State |
| --- | --- | --- |
| [`infra/vmon/omp_ci_template.py`](../vmon/omp_ci_template.py), [01-vmon-runners.md](01-vmon-runners.md), [02-omp-ci-template.md](02-omp-ci-template.md) | vmon (vibemon) per-job KVM microVM runners, selected with `runs-on: vmon-large/from=omp-ci` | **retired / optional**: no workflow uses the label |
| `infra/bazel-remote/` | k3s + ARC/Kata cluster cache: cluster-internal `bazel-remote` gRPC service (`grpcs://bazel-remote.bazel-cache.svc.cluster.local:9092`) with TLS + htpasswd | **not deployed by CI**; manifests and operator script kept |

### The one live reference to the cluster cache

[`.github/actions/bazel-cache`](../../.github/actions/bazel-cache/action.yml)
keeps a cluster remote-cache branch: when **both** `BAZEL_REMOTE_USER` and
`BAZEL_REMOTE_PASSWORD` are set it emits

```
common --remote_cache=grpcs://bazel-remote.bazel-cache.svc.cluster.local:9092
common --tls_certificate=infra/bazel-remote/ca.crt
```

No workflow sets those variables, so on GitHub-hosted runners the step always
takes the actions/cache disk path. The `ca.crt` line is a live path reference:
`infra/bazel-remote/ca.crt` must stay in the tree. Next to it,
`bazel-remote.yaml`, `runner-egress-patch.yaml` and `setup.sh` are the manifests
and bootstrap script for the service the certificate authenticates (see
`setup.sh` for the operator procedure). `setup.sh`'s closing notes mention
`infra/reload-runner.sh` and `infra/docs/04-arc-and-caching.md`, the ARC/Kata
runner half of that stack, which is **not** part of this tree anymore.

## Not restored by the upstream merge

The fork's Kata/ARC host tooling — `infra/reload-runner.sh`,
`infra/runner.Dockerfile`, `infra/tune-kata-runtime.sh`, and
`infra/docs/0{1-host-and-cluster,2-kata-runtime,3-runner-image,4-arc-and-caching}.md`
— was dropped by the merge resolution. Nothing under `.github/` or `scripts/`
references any of it (the ARC `omp-kata` label is used by no workflow), so it was
not restored; recover it from `main` if that host path is ever revived.

## Reading order

1. **[01-vmon-runners.md](01-vmon-runners.md)** — retired vmon runner labels, setup, trust split, operations (reference only).
2. **[02-omp-ci-template.md](02-omp-ci-template.md)** — what the `omp-ci` template bakes and how to build it (optional).
3. **[03-caching.md](03-caching.md)** — the caches CI actually uses today, plus the retired vmon cache model.
