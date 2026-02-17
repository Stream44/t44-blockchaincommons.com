⚠️ **WARNING:** This repository may get squashed and force-pushed if the [GordianOpenIntegrity](https://github.com/Stream44/t44-blockchaincommons.com) implementation must change in incompatible ways. Keep your diffs until the **GordianOpenIntegrity** system is stable.

🔷 **Open Development Project:** The implementation is a preview release for community feedback.

⚠️ **Disclaimer:** Under active development. Code has not been audited, APIs and interfaces are subject to change.

`t44` Capsules for Blockchain Commons
===

This project [encapsulates](https://github.com/Stream44/encapsulate) the [javascript APIs](https://github.com/leonardocustodio/bcts/tree/main) of the incredible [Gordian Stack](https://developer.blockchaincommons.com/) by [Blockchain Commons](https://www.blockchaincommons.com/) for use in [t44](https://github.com/Stream44/t44).
Blockchain Commons low-level libraries are wrapped into capsules and combined into new higher order capsules. Standalone use is also possible.

### TODO

- **GordianOpenIntegrity**
  - [ ] Review terminology and choices with Blockchain Commons.
    - [ ] Validate or Verify
  - [ ] Audit logic to ensure all integrity requirements are met and validations make sense.
  - [ ] JSON Schemas for Gordian Envelope and Provenance Mark properties in `.o/GordianOpenIntegrity.yaml`. Blockchain Commons should define schema on URL so we can link.
  - [ ] Review `.o/GordianOpenIntegrity.yaml` Gordian Envelope predicate/subject/object structure with Blockchain Commons to ensure compliance.
  - [ ] Minimal audit script hand coded by third party to validate integrity.
  - [ ] Third party review of `GordianOpenIntegrity` other than Blockchain Commons.
  - [ ] Declare `GordianOpenIntegrity` foundation as stable once Blockchain Commons agrees.

Capsules: Higher Order
---

### `XidDocumentLedger` (XID Document Ledger)

A utility to author a verifiable chain of xid documents.

Combines the `xid` and `provenance-mark` capsules to provide a verifiable ledger according to the [Revisions with Provenance Marks](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-010-xid.md#revisions-with-provenance-marks) approach.

Compatible with `provenance-mark-cli` storage format.

### `GitRepositoryIdentifier` (Git Repository Identifier)

A utility to establish an **identifier** for a `git` repository in the form of a `did:repo:<hash>` id.

**Documentation:** See the [Stream44 Studio Workshop](https://github.com/Stream44/Workshop) for complete pattern and tool documentation:
- **Pattern**: [WP-2026-01 — Git Repository Identifier](https://github.com/Stream44/Workshop/blob/main/Patterns/WP-2026-01-GitRepository-Identifier.md)
- **Tool**: [WT-2026-01 — Git Repository Identifier](https://github.com/Stream44/Workshop/blob/main/Tools/WT-2026-01-GitRepositoryIdentifier.md)


### `GitRepositoryIntegrity` (Git Repository Integrity)

A utility to validate the integrity of a `git` repository across four progressive layers: commit origin, repository identifier, Gordian Open Integrity provenance, and XID document governance.

**Documentation:** See the [Stream44 Studio Workshop](https://github.com/Stream44/Workshop) for complete pattern and tool documentation:
- **Pattern**: [WP-2026-02 — Git Repository Integrity](https://github.com/Stream44/Workshop/blob/main/Patterns/WP-2026-02-GitRepository-Integrity.md)
- **Tool**: [WT-2026-02 — Git Repository Integrity](https://github.com/Stream44/Workshop/blob/main/Tools/WT-2026-02-GitRepositoryIntegrity.md)


### `GordianOpenIntegrity` (Gordian Open Integrity)

A utility to record decisions **about** a git repository, **in** the git repository, in a cryptographically rigerous way leveraging XID Documents. The logical space is initialized by creating a **trust root** XID Document tied to the `GitRepositoryIdentifier` ensuring that author details including signing key match.

**Documentation:** See the [Stream44 Studio Workshop](https://github.com/Stream44/Workshop) for complete pattern and tool documentation:
- **Pattern**: [WP-2026-03 — Gordian Open Integrity](https://github.com/Stream44/Workshop/blob/main/Patterns/WP-2026-03-GitRepository-GordianOpenIntegrity.md)
- **Tool**: [WT-2026-03 — Gordian Open Integrity](https://github.com/Stream44/Workshop/blob/main/Tools/WT-2026-03-GordianOpenIntegrity.md)

```
# Initialize a trust root for a git repository (ed25519 keys required)
bunx @stream44.studio/t44-blockchaincommons.com init [GordianOpenIntegrity] --first-trust-key ~/.ssh/trust_root_key --provenance-key ~/.ssh/provenance_key

# Validate a git repository
bunx @stream44.studio/t44-blockchaincommons.com validate [GordianOpenIntegrity]
```

Github Actions validation workflow: `.github/workflows/gordian-open-integrity.yaml`
```
name: Gordian Open Integrity

on: [push, pull_request]

jobs:
  gordian-open-integrity:
    name: Gordian Open Integrity
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: Stream44/t44-blockchaincommons.com@main
```

The trust root commit is tied to a XID Document stored in git at `.o/GordianOpenIntegrity.yaml` with the provenance mark generator file kept at `.git/o/GordianOpenIntegrity-generator.yaml`. From there, the Gordian Envelope system is used to **introduce** new decision assets that may be stored at `.o/<domain.tld>/my/path/doc.yaml` and `.git/o/<domain.tld>/my/path/doc-generator.yaml`. Implementers can design their own URI layouts and **Gordian Envelope Spaces**.

The capsule uses a `XidDocumentLedger` per document (across commits) and provides a minimal abstraction for `provenance-mark` enforced ledgers of XID Documents in git repositories tied cryptographically to a [WP-2026-01-GitRepository-Identifier](https://github.com/Stream44/Workshop/blob/main/Patterns/WP-2026-01-GitRepository-Identifier.md) commit. `lifehash` is used to store the inception and current provenance mark at `.o/GordianOpenIntegrity-InceptionLifehash.svg` and `.o/GordianOpenIntegrity-CurrentLifehash.svg` respectively. See *[Provenance](#provenance)* footer below for the lifehash marks for this repository.

Given the latest provenance mark via a publishing channel, users are able to verify the integrity of all decisions recorded against the repository with complete confidence. This verification includes the repository code thus allowing for distribution via public peer-to-peer networks. This is stable foundation for transparent distributed governance and the exploration of cryptographic decision making and relationship building.

`.o/GordianOpenIntegrity.yaml` example from `examples/03-GordianOpenIntegrity/main.test.ts`:
```
$schema: "https://json-schema.org/draft/2020-12/schema"
$defs:
  envelope:
    $ref: "https://datatracker.ietf.org/doc/draft-mcnally-envelope/"
  mark:
    $ref: "https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2025-001-provenance-mark.md"
envelope: "ur:envelope/lptpsota ... lbenmhhf"
mark: "1097246a"
---
# Repository DID: did:repo:47c1a6772338d3cf589fb985a51b747b3a9d09cf
# Current Mark: 1097246a (🅑 BLUE MISS DARK ITEM)
# Inception Mark: 03dc39ac (🅑 APEX UNDO EYES PLUS)
# XID(9e560ab4) [
#     "GordianOpenIntegrity.SigningKey": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQfr21iYSvICyxXhXKdq/MEU0sC2mMErqaMfSDans6F test_ed25519"
#     'key': Bytes(78) [
#         'allow': 'All'
#     ]
#     'provenance': Bytes(115)
#     "GordianOpenIntegrity.RepositoryIdentifier": "did:repo:47c1a6772338d3cf589fb985a51b747b3a9d09cf"
# ]
# Trust established using https://github.com/Stream44/t44-BlockchainCommons.com
```

Commits that lead to this document:
```
% git log
commit 8e1a7fb5be0e14e2411ef97afb4e4f0cc6de1e9d (HEAD -> main)
Author: Christoph Dorn <christoph@christophdorn.com>
Date:   Mon Feb 16 21:53:53 2026 -0500

    [GordianOpenIntegrity] Establish inception Gordian Envelope at: .o/GordianOpenIntegrity.yaml
    
    Trust established using https://github.com/Stream44/t44-BlockchainCommons.com
    
    Signed-off-by: Christoph Dorn <christoph@christophdorn.com>

commit 27702749d720f2d6fb5f90635c19771e2936cbb7
Author: Christoph Dorn <christoph@christophdorn.com>
Date:   Mon Feb 16 21:53:53 2026 -0500

    [RepositoryIdentifier] Track 47c1a677
    
    Signed-off-by: Christoph Dorn <christoph@christophdorn.com>

commit 47c1a6772338d3cf589fb985a51b747b3a9d09cf
Author: Christoph Dorn <christoph@christophdorn.com>
Date:   Tue Feb 17 02:53:53 2026 +0000

    [RepositoryIdentifier] Establish signed repository identifier.
    
    Signed-off-by: Christoph Dorn <christoph@christophdorn.com>
```


Capsules: Low Level
---

These capsules wrap Blockchain Commons [Gordian Stack](https://developer.blockchaincommons.com/) [javascript](https://github.com/leonardocustodio/bcts/tree/main) libraries with some additional functionality.

### `fs` (Filesystem Tools)

A utility for common filesystem needs.

### `git` (Git Tools)

A utility that abstracts away the `git` CLI tool for convenient access from JavaScript.

### `key` (ed25519 Cryptographic Key Tools)

A utility to work with `ed25519` keys.

### `xid` (XID: Extensible Identifiers)

An eXtensible IDentifier (XID) is a stable decentralized identifier generated from the hash of an inception key. XIDs resolve to an [envelope](https://developer.blockchaincommons.com/envelope/)-based controller document for managing keys, credentials, and other assertions, and leverage provenance chains for key rotation and revocation without changing the identifier. It does not necessarily to the [DID spec](https://www.w3.org/TR/did-core/), but it is inspired by the same needs and desires.

  * Introduction: https://www.blockchaincommons.com/musings/XIDs-True-SSI/
  * Project Home: https://developer.blockchaincommons.com/xid/
  * Research Paper: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-010-xid.md

### `provenance-mark` (Provenance Marks)

A Provenance Mark is a forward-commitment hash chain to establish cryptographic sequential ordering for linked digital objects. Each mark in the chain commits to preceding and subsequent content, preventing retroactive insertion or modification without requiring timestamps or trusted witnesses. This enables tracking of editions, state changes, and histories for controller documents, credentials, and evolving structures.

  * Project Home: https://developer.blockchaincommons.com/provemark/
  * Research Paper: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2025-001-provenance-mark.md

### `provenance-mark-cli` (Provenance Mark CLI)

A command line tool for creating and managing Provenance Mark chains.

  * JavaScipt Implementation: https://github.com/leonardocustodio/bcts/tree/main/tools/provenance-mark-cli
  * Research Paper: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2025-001-provenance-mark.md

### `open-integrity` (Open Integrity Project)

Open Integrity is an initiative by Blockchain Commons to integrate cryptographic trust mechanisms into Git repositories. By leveraging Git's native SSH signing capabilities and structured verification processes, we ensure transparency, provenance, and immutability for software projects.

  * Project Home: https://github.com/OpenIntegrityProject/core

### `lifehash` (LifeHash)

LifeHash is a method of hash visualization based on Conway’s Game of Life that creates beautiful icons that are deterministic, yet distinct and unique given the input data. It is part of the [OIB](https://developer.blockchaincommons.com/oib/).

  * Introduction: https://developer.blockchaincommons.com/oib/
  * Project Home: https://developer.blockchaincommons.com/lifehash/


Projects
===

The following projects use `GordianOpenIntegrity`:

- [t44](https://github.com/Stream44/t44) - A web3 + AI ready workspace
- [Stream44.Studio](https://stream44.studio) - A **full-stack IDE** for building **embodied distributed systems**


Provenance
===

[![Gordian Open Integrity](https://github.com/Stream44/t44-blockchaincommons.com/actions/workflows/gordian-open-integrity.yaml/badge.svg)](https://github.com/Stream44/t44-blockchaincommons.com/actions/workflows/gordian-open-integrity.yaml?query=branch%3Amain) [![DCO Signatures](https://github.com/Stream44/t44-blockchaincommons.com/actions/workflows/dco.yaml/badge.svg)](https://github.com/Stream44/t44-blockchaincommons.com/actions/workflows/dco.yaml?query=branch%3Amain)

Repository DID: `did:repo:c8f51118b7dca6f9d7303c240b6a683d85e28dab`

<table>
  <tr>
    <td><strong>Inception Mark</strong></td>
    <td><img src=".o/GordianOpenIntegrity-InceptionLifehash.svg" width="64" height="64"></td>
    <td><strong>Current Mark</strong></td>
    <td><img src=".o/GordianOpenIntegrity-CurrentLifehash.svg" width="64" height="64"></td>
    <td>Trust established using<br/><a href="https://github.com/Stream44/t44-blockchaincommons.com">Stream44/t44-BlockchainCommons.com</a></td>
  </tr>
</table>

(c) 2026 [Christoph.diy](https://christoph.diy) • Code: `BSD-2-Clause-Patent` • Text: `CC-BY` • Created with [Stream44.Studio](https://Stream44.Studio)

### Credits & Thank You!

* [@ChristopherA](https://github.com/ChristopherA), [@WolfMcNally](https://github.com/wolfmcnally) and [@shannona](https://github.com/shannona) of [Blockchain Commons](https://www.blockchaincommons.com/) for **all original work** on the [The Gordian Stack](https://developer.blockchaincommons.com/).
* [Leonardo Custodio](https://github.com/leonardocustodio) for porting *The Gordian Stack* **Rust** implementations to **TypeScript**.
