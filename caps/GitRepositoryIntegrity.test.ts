#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect, workbenchDir },
    oi,
    integrity,
    key,
    git,
    fs,
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/WorkspaceTest',
                    options: {
                        '#': {
                            bunTest,
                            env: {}
                        }
                    }
                },
                oi: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './GordianOpenIntegrity'
                },
                integrity: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './GitRepositoryIntegrity'
                },
                key: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './key'
                },
                git: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './git'
                },
                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './fs'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/GitRepositoryIntegrity.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})


// ──────────────────────────────────────────────────────────────────────
// LAYER 1 — Commit Origin
// ──────────────────────────────────────────────────────────────────────

describe('Layer 1 — Commit Signatures', function () {

    describe('success: all commits signed', function () {

        const keysDir = `${workbenchDir}/l1-sig-success-keys`
        const repoDir = `${workbenchDir}/l1-sig-success-repo`

        it('should validate all commits are signed', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'sig_success' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })
            await git.addSignedCommit({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com', message: 'Second commit' })

            const result = await integrity.validateCommitSignatures({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.totalCommits).toBe(2)
            expect(result.signedCommits).toBe(2)
            expect(result.unsignedCommits).toBe(0)
            expect(result.issues).toEqual([])
        })
    })

    describe('success: all commits signed with allowed signers', function () {

        const keysDir = `${workbenchDir}/l1-sig-allowed-keys`
        const repoDir = `${workbenchDir}/l1-sig-allowed-repo`

        it('should validate signatures against allowed signers', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'sig_allowed' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })

            const result = await integrity.validateCommitSignatures({
                repoDir,
                allowedSigners: [{ email: 'alice@test.com', publicKey: sigKey.publicKey }],
            })
            expect(result.valid).toBe(true)
            expect(result.totalCommits).toBe(1)
            expect(result.signedCommits).toBe(1)
            expect(result.unsignedCommits).toBe(0)
            expect(result.issues).toEqual([])
        })
    })

    describe('failure: unsigned commit present', function () {

        const keysDir = `${workbenchDir}/l1-sig-fail-keys`
        const repoDir = `${workbenchDir}/l1-sig-fail-repo`

        it('should detect unsigned commits', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'sig_fail' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })
            await git.addUnsignedCommit({ repoDir, authorName: 'Alice', authorEmail: 'alice@test.com', message: 'Unsigned commit' })

            const result = await integrity.validateCommitSignatures({ repoDir })
            expect(result.valid).toBe(false)
            expect(result.unsignedCommits).toBe(1)
            expect(result.issues.length).toBeGreaterThan(0)
            expect(result.issues[0]).toContain('is not signed')
        })
    })

    describe('failure: wrong allowed signer', function () {

        const keysDir = `${workbenchDir}/l1-sig-wrongsigner-keys`
        const repoDir = `${workbenchDir}/l1-sig-wrongsigner-repo`

        it('should fail when commit signed by unknown key', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'sig_real' })
            const wrongKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'sig_wrong' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })

            const result = await integrity.validateCommitSignatures({
                repoDir,
                allowedSigners: [{ email: 'bob@test.com', publicKey: wrongKey.publicKey }],
            })
            expect(result.valid).toBe(false)
            expect(result.unsignedCommits).toBe(1)
            expect(result.issues.length).toBeGreaterThan(0)
            expect(result.issues[0]).toContain('invalid or unverifiable signatures')
        })
    })
})

describe('Layer 1 — Commit Sign-offs', function () {

    describe('success: all commits have sign-off', function () {

        const keysDir = `${workbenchDir}/l1-signoff-success-keys`
        const repoDir = `${workbenchDir}/l1-signoff-success-repo`

        it('should validate all commits have Signed-off-by', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'signoff_success' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })

            const result = await integrity.validateCommitSignoffs({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.totalCommits).toBe(1)
            expect(result.signedOffCommits).toBe(1)
            expect(result.issues).toEqual([])
        })
    })

    describe('failure: commit missing sign-off', function () {

        const keysDir = `${workbenchDir}/l1-signoff-fail-keys`
        const repoDir = `${workbenchDir}/l1-signoff-fail-repo`

        it('should detect commits without Signed-off-by', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'signoff_fail' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })
            // Add a commit without --signoff
            await git.run({
                args: [
                    '-c', 'gpg.format=ssh',
                    '-c', `user.signingkey=${sigKey.privateKeyPath}`,
                    'commit', '--allow-empty', '--gpg-sign', '-m', 'No signoff',
                ],
                cwd: repoDir,
                env: {
                    GIT_AUTHOR_NAME: 'Alice',
                    GIT_AUTHOR_EMAIL: 'alice@test.com',
                    GIT_COMMITTER_NAME: 'Alice',
                    GIT_COMMITTER_EMAIL: 'alice@test.com',
                },
            })

            const result = await integrity.validateCommitSignoffs({ repoDir })
            expect(result.valid).toBe(false)
            expect(result.signedOffCommits).toBe(1)
            expect(result.totalCommits).toBe(2)
            expect(result.issues.length).toBe(1)
            expect(result.issues[0]).toContain('missing Signed-off-by trailer')
        })
    })
})

describe('Layer 1 — Author Consistency', function () {

    describe('success: consistent author per key', function () {

        const keysDir = `${workbenchDir}/l1-author-success-keys`
        const repoDir = `${workbenchDir}/l1-author-success-repo`

        it('should validate consistent author identity per key', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_success' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })
            await git.addSignedCommit({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com', message: 'Second commit' })

            const result = await integrity.validateAuthorConsistency({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.totalCommits).toBe(2)
            expect(result.issues).toEqual([])
        })
    })

    describe('failure: same key different author', function () {

        const keysDir = `${workbenchDir}/l1-author-fail-keys`
        const repoDir = `${workbenchDir}/l1-author-fail-repo`

        it('should detect multiple authors using the same key', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_fail' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })
            await git.addSignedCommit({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Bob', authorEmail: 'bob@test.com', message: 'Impersonation commit' })

            const result = await integrity.validateAuthorConsistency({ repoDir })
            expect(result.valid).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
            expect(result.issues[0]).toContain('used by multiple authors')
        })
    })
})

// ──────────────────────────────────────────────────────────────────────
// LAYER 2 — Repository Identifier
// ──────────────────────────────────────────────────────────────────────

describe('Layer 2 — Repository Identifier', function () {

    describe('success: valid repository identifier', function () {

        const keysDir = `${workbenchDir}/l2-id-success-keys`
        const repoDir = `${workbenchDir}/l2-id-success-repo`

        it('should validate a proper repository identifier', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'id_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'id_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'IdAuthor',
                authorEmail: 'id@test.com',
            })

            const result = await integrity.validateRepositoryIdentifier({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.did).toStartWith('did:repo:')
        })
    })

    describe('failure: no repository identifier', function () {

        const keysDir = `${workbenchDir}/l2-id-fail-keys`
        const repoDir = `${workbenchDir}/l2-id-fail-repo`

        it('should fail when no .repo-identifier exists', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'id_fail' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })

            const result = await integrity.validateRepositoryIdentifier({ repoDir })
            expect(result.valid).toBe(false)
        })
    })
})

// ──────────────────────────────────────────────────────────────────────
// LAYER 3 — Gordian Open Integrity Provenance
// ──────────────────────────────────────────────────────────────────────

describe('Layer 3 — Provenance Chain', function () {

    describe('success: valid provenance chain', function () {

        const keysDir = `${workbenchDir}/l3-chain-success-keys`
        const repoDir = `${workbenchDir}/l3-chain-success-repo`
        let publishedMark: string

        it('should set up repo and verify provenance chain', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'chain_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'chain_prov' })
            const result = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'ChainAuthor',
                authorEmail: 'chain@test.com',
            })
            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should verify with correct published mark', async function () {
            const result = await integrity.verify({ repoDir, mark: publishedMark })
            expect(result.valid).toBe(true)
            expect(result.marksMonotonic).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.issues).toEqual([])
        })

        it('should verify without a mark', async function () {
            const result = await integrity.verify({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.marksMonotonic).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    describe('failure: wrong published mark', function () {

        const keysDir = `${workbenchDir}/l3-chain-wrongmark-keys`
        const repoDir = `${workbenchDir}/l3-chain-wrongmark-repo`

        it('should fail with wrong published mark', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'chain_wrongmark' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'chain_wrongmark_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'WrongMark',
                authorEmail: 'wrongmark@test.com',
            })

            const result = await integrity.verify({ repoDir, mark: 'wrong-mark-id' })
            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
            expect(result.issues[0]).toContain('does not match latest provenance mark')
        })
    })

    describe('failure: no provenance documents', function () {

        const keysDir = `${workbenchDir}/l3-chain-noprov-keys`
        const repoDir = `${workbenchDir}/l3-chain-noprov-repo`

        it('should fail when no provenance documents exist', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'chain_noprov' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })

            const result = await integrity.verify({ repoDir })
            expect(result.valid).toBe(false)
            expect(result.issues).toContain('No provenance documents found in repository history')
        })
    })
})

describe('Layer 3 — XID Stability', function () {

    describe('success: stable XID across versions', function () {

        const keysDir = `${workbenchDir}/l3-xid-success-keys`
        const repoDir = `${workbenchDir}/l3-xid-success-repo`

        it('should verify XID stability after key rotation', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'xid_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'xid_prov' })
            const newKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'rotated_xid' })
            const result = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'XidAuthor',
                authorEmail: 'xid@test.com',
            })

            // Rotate key — XID should remain stable
            await oi.rotateTrustSigningKey({
                repoDir,
                authorName: 'XidAuthor',
                authorEmail: 'xid@test.com',
                existingSigningKeyPath: sigKey.privateKeyPath,
                newSigningKeyPath: newKey.privateKeyPath,
                author: result.author,
            })

            const verifyResult = await integrity.verify({ repoDir })
            expect(verifyResult.valid).toBe(true)
            expect(verifyResult.xidStable).toBe(true)
            expect(verifyResult.provenanceVersions).toBe(2)
            expect(verifyResult.issues).toEqual([])
        })
    })
})

describe('Layer 3 — Document Verification', function () {

    describe('success: valid document', function () {

        const keysDir = `${workbenchDir}/l3-doc-success-keys`
        const repoDir = `${workbenchDir}/l3-doc-success-repo`
        const DOC_PATH = '.o/decisions/policy.yaml'
        const DOC_GEN = '.git/o/decisions/policy-generator.yaml'
        let publishedDocMark: string

        it('should set up repo with document', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_prov' })
            const repoResult = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'DocAuthor',
                authorEmail: 'doc@test.com',
            })

            const docKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_doc_key' })
            const docProvKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_doc_prov' })
            const doc = await oi.createDocument({
                documentKeyPath: docKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
            })
            const docResult = await oi.introduceDocument({
                repoDir,
                authorName: 'DocAuthor',
                authorEmail: 'doc@test.com',
                trustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
                document: doc,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN,
                author: repoResult.author,
            })
            publishedDocMark = await oi.getMarkIdentifier({ mark: docResult.documentMark })
        })

        it('should verify document with correct mark', async function () {
            const result = await integrity.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
                mark: publishedDocMark,
            })
            expect(result.valid).toBe(true)
            expect(result.documentPathValid).toBe(true)
            expect(result.documentsMapValid).toBe(true)
            expect(result.marksMonotonic).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.issues).toEqual([])
        })

        it('should verify document without mark', async function () {
            const result = await integrity.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
            })
            expect(result.valid).toBe(true)
            expect(result.documentPathValid).toBe(true)
            expect(result.documentsMapValid).toBe(true)
        })
    })

    describe('failure: non-existent document', function () {

        const keysDir = `${workbenchDir}/l3-doc-noexist-keys`
        const repoDir = `${workbenchDir}/l3-doc-noexist-repo`

        it('should fail for non-existent document path', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_noexist' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_noexist_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'NoExist',
                authorEmail: 'noexist@test.com',
            })

            const result = await integrity.verifyDocument({
                repoDir,
                documentPath: '.o/nonexistent.yaml',
            })
            expect(result.valid).toBe(false)
            expect(result.issues).toContain('No provenance documents found at .o/nonexistent.yaml')
        })
    })

    describe('failure: wrong document mark', function () {

        const keysDir = `${workbenchDir}/l3-doc-wrongmark-keys`
        const repoDir = `${workbenchDir}/l3-doc-wrongmark-repo`
        const DOC_PATH = '.o/decisions/charter.yaml'
        const DOC_GEN = '.git/o/decisions/charter-generator.yaml'

        it('should fail with wrong document mark', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_wrongmark' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_wrongmark_prov' })
            const repoResult = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'WrongDocMark',
                authorEmail: 'wrongdocmark@test.com',
            })

            const docKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_wrongmark_doc_key' })
            const docProvKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_wrongmark_doc_prov' })
            const doc = await oi.createDocument({
                documentKeyPath: docKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
            })
            await oi.introduceDocument({
                repoDir,
                authorName: 'WrongDocMark',
                authorEmail: 'wrongdocmark@test.com',
                trustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
                document: doc,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN,
                author: repoResult.author,
            })

            const result = await integrity.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
                mark: 'wrong-mark',
            })
            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
        })
    })
})

// ──────────────────────────────────────────────────────────────────────
// LAYER 4 — XID Document Governance
// ──────────────────────────────────────────────────────────────────────

describe('Layer 4 — Strict: signersAllAuthorized', function () {

    describe('success: all signers authorized after key rotation', function () {

        const keysDir = `${workbenchDir}/l4-signers-success-keys`
        const repoDir = `${workbenchDir}/l4-signers-success-repo`

        it('should pass strict signersAllAuthorized after key rotation', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'signers_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'signers_prov' })
            const newKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'rotated_signer' })
            const repoResult = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'SignerAuth',
                authorEmail: 'signerauth@test.com',
            })

            // Rotate key — both old and new keys should be in provenance history
            const rotResult = await oi.rotateTrustSigningKey({
                repoDir,
                authorName: 'SignerAuth',
                authorEmail: 'signerauth@test.com',
                existingSigningKeyPath: sigKey.privateKeyPath,
                newSigningKeyPath: newKey.privateKeyPath,
                author: repoResult.author,
            })

            // Commit with new key
            await oi.commitToRepository({
                repoDir,
                authorName: 'SignerAuth',
                authorEmail: 'signerauth@test.com',
                signingKeyPath: newKey.privateKeyPath,
                message: 'Post-rotation commit',
                files: [{ path: 'README.md', content: '# Test\n' }],
            })

            const result = await integrity.verify({
                repoDir,
                strict: { signersAllAuthorized: true },
            })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    describe('failure: unauthorized signer', function () {

        const keysDir = `${workbenchDir}/l4-signers-fail-keys`
        const repoDir = `${workbenchDir}/l4-signers-fail-repo`

        it('should fail when commit signed by unauthorized key', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'signers_fail' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'signers_fail_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'UnAuth',
                authorEmail: 'unauth@test.com',
            })

            // Create a commit with a different key not in the XID document
            const rogueKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'rogue_key' })
            await git.addSignedCommit({ repoDir, signingKeyPath: rogueKey.privateKeyPath, authorName: 'Rogue', authorEmail: 'rogue@test.com', message: 'Rogue commit' })

            // Without strict mode, verify should still pass (it collects signers from provenance)
            // but the rogue key won't be in the allowed signers list
            const result = await integrity.verify({
                repoDir,
                strict: { signersAllAuthorized: true },
            })
            expect(result.valid).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
            // The audit will find the rogue commit has invalid signature
            const hasUnauthorized = result.issues.some((i: string) =>
                i.includes('invalid signatures') || i.includes('not authorized')
            )
            expect(hasUnauthorized).toBe(true)
        })
    })
})

describe('Layer 4 — Strict: repoIdentifierIsInceptionCommit', function () {

    describe('success: repo identifier is inception commit', function () {

        const keysDir = `${workbenchDir}/l4-repoid-success-keys`
        const repoDir = `${workbenchDir}/l4-repoid-success-repo`

        it('should pass when repo identifier matches inception commit', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'repoid_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'repoid_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'RepoId',
                authorEmail: 'repoid@test.com',
            })

            const result = await integrity.verify({
                repoDir,
                strict: { repoIdentifierIsInceptionCommit: true },
            })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })
    })
})

describe('Layer 4 — Strict: both flags combined', function () {

    describe('success: full strict validation after key rotation and document', function () {

        const keysDir = `${workbenchDir}/l4-both-success-keys`
        const repoDir = `${workbenchDir}/l4-both-success-repo`
        const DOC_PATH = '.o/governance/policy.yaml'
        const DOC_GEN = '.git/o/governance/policy-generator.yaml'

        it('should pass full strict validation', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'both_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'both_prov' })
            const newKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'both_rotated' })
            const repoResult = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'BothStrict',
                authorEmail: 'both@test.com',
            })

            // Rotate key
            const rotResult = await oi.rotateTrustSigningKey({
                repoDir,
                authorName: 'BothStrict',
                authorEmail: 'both@test.com',
                existingSigningKeyPath: sigKey.privateKeyPath,
                newSigningKeyPath: newKey.privateKeyPath,
                author: repoResult.author,
            })

            // Introduce document with rotated key
            const docKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'both_doc_key' })
            const docProvKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'both_doc_prov' })
            const doc = await oi.createDocument({
                documentKeyPath: docKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
            })
            await oi.introduceDocument({
                repoDir,
                authorName: 'BothStrict',
                authorEmail: 'both@test.com',
                trustKeyPath: newKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
                document: doc,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN,
                author: rotResult.author,
            })

            // Verify repo with both strict flags
            const verifyRepoResult = await integrity.verify({
                repoDir,
                strict: {
                    repoIdentifierIsInceptionCommit: true,
                    signersAllAuthorized: true,
                },
            })
            expect(verifyRepoResult.valid).toBe(true)
            expect(verifyRepoResult.issues).toEqual([])

            // Verify document with both strict flags
            const docResult = await integrity.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
                strict: {
                    repoIdentifierIsInceptionCommit: true,
                    signersAllAuthorized: true,
                },
            })
            expect(docResult.valid).toBe(true)
            expect(docResult.documentPathValid).toBe(true)
            expect(docResult.documentsMapValid).toBe(true)
            expect(docResult.issues).toEqual([])
        })
    })
})

// ──────────────────────────────────────────────────────────────────────
// COMPREHENSIVE — validate
// ──────────────────────────────────────────────────────────────────────

describe('Comprehensive — validate', function () {

    describe('success: full validation on OI repo', function () {

        const keysDir = `${workbenchDir}/validate-success-keys`
        const repoDir = `${workbenchDir}/validate-success-repo`

        it('should pass comprehensive validation', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'validate_success' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'validate_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Validator',
                authorEmail: 'validator@test.com',
            })

            const result = await integrity.validate({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.layers.commitSignatures.valid).toBe(true)
            expect(result.layers.commitSignoffs.valid).toBe(true)
            expect(result.layers.authorConsistency.valid).toBe(true)
            expect(result.layers.repositoryIdentifier.valid).toBe(true)
            expect(result.layers.provenanceChain).toBeDefined()
            expect(result.layers.provenanceChain.valid).toBe(true)
            expect(result.layers.xidStability).toBeDefined()
            expect(result.layers.xidStability.valid).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    describe('success: validate with strict mode', function () {

        const keysDir = `${workbenchDir}/validate-strict-keys`
        const repoDir = `${workbenchDir}/validate-strict-repo`

        it('should pass comprehensive validation with strict flags', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'validate_strict' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'validate_strict_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'StrictValidator',
                authorEmail: 'strict@test.com',
            })

            const result = await integrity.validate({
                repoDir,
                strict: {
                    repoIdentifierIsInceptionCommit: true,
                    signersAllAuthorized: true,
                },
            })
            expect(result.valid).toBe(true)
            expect(result.layers.repoIdentifierIsInceptionCommit).toBeDefined()
            expect(result.layers.repoIdentifierIsInceptionCommit.valid).toBe(true)
            expect(result.layers.signerAuthorization).toBeDefined()
            expect(result.layers.signerAuthorization.valid).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    describe('failure: plain repo without identifier', function () {

        const keysDir = `${workbenchDir}/validate-noid-keys`
        const repoDir = `${workbenchDir}/validate-noid-repo`

        it('should report missing repository identifier', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'validate_noid' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Alice', authorEmail: 'alice@test.com' })

            const result = await integrity.validate({ repoDir })
            expect(result.valid).toBe(false)
            expect(result.layers.commitSignatures.valid).toBe(true)
            expect(result.layers.commitSignoffs.valid).toBe(true)
            expect(result.layers.repositoryIdentifier.valid).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
        })
    })

    describe('failure: unsigned commit in OI repo', function () {

        const keysDir = `${workbenchDir}/validate-unsigned-keys`
        const repoDir = `${workbenchDir}/validate-unsigned-repo`

        it('should detect unsigned commit in comprehensive validation', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'validate_unsigned' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'validate_unsigned_prov' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'UnsignedVal',
                authorEmail: 'unsigned@test.com',
            })

            // Add unsigned commit
            await git.addUnsignedCommit({ repoDir, authorName: 'UnsignedVal', authorEmail: 'unsigned@test.com', message: 'Unsigned commit' })

            const result = await integrity.validate({ repoDir })
            expect(result.valid).toBe(false)
            expect(result.layers.commitSignatures.valid).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
        })
    })
})

