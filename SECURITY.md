# Security policy

normkompass is a reference implementation under development. Only the `main` branch is maintained.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/sotream/normkompass/security/advisories/new)
for this repository. Do not open a public issue for security problems.

Include a description, steps to reproduce, and the affected commit. This is a
personal project: there is no guaranteed response time, but reports are read and
acknowledged on a best-effort basis.

## Scope

Secrets must never be committed. Only `.env.example` with placeholder values belongs in the repository.
