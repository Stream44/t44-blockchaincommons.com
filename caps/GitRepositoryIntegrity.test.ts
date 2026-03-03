#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from '@stream44.studio/t44/standalone-rt'

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
                    value: '@stream44.studio/t44/caps/ProjectTest',
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
        capsuleName: '@stream44.studio/t44/caps/patterns/blockchaincommons.com/GitRepositoryIntegrity.test'
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
// SIGNATURE CLASSIFICATION — auditSignatures & verify edge cases
//
// Tests the correct classification of commits into:
//   - VALID: signed with key in envelope
//   - KEY NOT IN ENVELOPE: signed but key not in allowed signers
//   - UNSIGNED: no signature at all
// ──────────────────────────────────────────────────────────────────────

describe('Signature Classification — auditSignatures', function () {

    describe('key not in envelope is correctly distinguished from unsigned', function () {

        const keysDir = `${workbenchDir}/sigclass-keynotinenv-keys`
        const repoDir = `${workbenchDir}/sigclass-keynotinenv-repo`

        it('should classify commit signed with unknown key as key-not-in-envelope, not unsigned', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov_key' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author',
                authorEmail: 'author@test.com',
            })

            // Commit with a different SSH key NOT in the envelope
            const externalKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'external_key' })
            await git.addSignedCommit({ repoDir, signingKeyPath: externalKey.privateKeyPath, authorName: 'External', authorEmail: 'external@test.com', message: 'External contributor commit' })

            const result = await integrity.verify({ repoDir })

            // Should pass without strict mode (key-not-in-envelope is only a warning)
            expect(result.valid).toBe(true)

            // The external commit should be in the commits list and marked as invalid
            const externalCommit = result.commits.find((c: any) => c.message === 'External contributor commit')
            expect(externalCommit).toBeDefined()
            expect(externalCommit.signatureValid).toBe(false)
            // Crucially: signatureStatus should NOT be 'N' (unsigned)
            expect(externalCommit.signatureStatus).not.toBe('N')
        })
    })

    describe('truly unsigned commit is correctly detected', function () {

        const keysDir = `${workbenchDir}/sigclass-unsigned-keys`
        const repoDir = `${workbenchDir}/sigclass-unsigned-repo`

        it('should classify commit without any signature as unsigned (status N)', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov_key' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author',
                authorEmail: 'author@test.com',
            })

            // Add a truly unsigned commit
            await git.addUnsignedCommit({ repoDir, authorName: 'Unsigned', authorEmail: 'unsigned@test.com', message: 'No signature commit' })

            const result = await integrity.verify({ repoDir })

            // Should fail — unsigned commits are always errors
            expect(result.valid).toBe(false)
            expect(result.issues.some((i: string) => i.includes('unsigned'))).toBe(true)

            // The unsigned commit should have signatureStatus 'N'
            const unsignedCommit = result.commits.find((c: any) => c.message === 'No signature commit')
            expect(unsignedCommit).toBeDefined()
            expect(unsignedCommit.signatureValid).toBe(false)
            expect(unsignedCommit.signatureStatus).toBe('N')
        })
    })

    describe('mixed repo: signed + unsigned + key-not-in-envelope', function () {

        const keysDir = `${workbenchDir}/sigclass-mixed-keys`
        const repoDir = `${workbenchDir}/sigclass-mixed-repo`

        it('should correctly classify all three types in a single repo', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov_key' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author',
                authorEmail: 'author@test.com',
            })

            // 1. Add a signed commit with the authorized key (valid)
            await git.addSignedCommit({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Author', authorEmail: 'author@test.com', message: 'Authorized signed commit' })

            // 2. Add a signed commit with an external key (key not in envelope)
            const externalKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'external_key' })
            await git.addSignedCommit({ repoDir, signingKeyPath: externalKey.privateKeyPath, authorName: 'External', authorEmail: 'external@test.com', message: 'External signed commit' })

            // 3. Add a truly unsigned commit
            await git.addUnsignedCommit({ repoDir, authorName: 'Unsigned', authorEmail: 'unsigned@test.com', message: 'Truly unsigned commit' })

            const result = await integrity.verify({ repoDir })

            // Should fail because of the unsigned commit
            expect(result.valid).toBe(false)
            expect(result.issues.some((i: string) => i.includes('unsigned'))).toBe(true)
            // Should NOT have key-not-in-envelope in issues (not strict mode)
            expect(result.issues.some((i: string) => i.includes('not in Gordian envelope'))).toBe(false)

            // Check individual commit classifications
            const authorizedCommit = result.commits.find((c: any) => c.message === 'Authorized signed commit')
            expect(authorizedCommit.signatureValid).toBe(true)

            const externalCommit = result.commits.find((c: any) => c.message === 'External signed commit')
            expect(externalCommit.signatureValid).toBe(false)
            expect(externalCommit.signatureStatus).not.toBe('N')

            const unsignedCommit = result.commits.find((c: any) => c.message === 'Truly unsigned commit')
            expect(unsignedCommit.signatureValid).toBe(false)
            expect(unsignedCommit.signatureStatus).toBe('N')
        })
    })
})

describe('Signature Classification — strict.signersAllAuthorized with key-not-in-envelope', function () {

    describe('without strict: key-not-in-envelope passes verification', function () {

        const keysDir = `${workbenchDir}/sigclass-strict-off-keys`
        const repoDir = `${workbenchDir}/sigclass-strict-off-repo`

        it('should pass when external contributor commits are present and strict is off', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov_key' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author',
                authorEmail: 'author@test.com',
            })

            // External contributor with valid SSH signature but key not in envelope
            const contribKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'contrib_key' })
            await git.addSignedCommit({ repoDir, signingKeyPath: contribKey.privateKeyPath, authorName: 'Contributor', authorEmail: 'contrib@test.com', message: 'PR merge commit' })

            const result = await integrity.verify({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
            expect(result.invalidSignatures).toBe(1)
        })
    })

    describe('with strict: key-not-in-envelope fails verification', function () {

        const keysDir = `${workbenchDir}/sigclass-strict-on-keys`
        const repoDir = `${workbenchDir}/sigclass-strict-on-repo`

        it('should fail when external contributor commits are present and strict.signersAllAuthorized is on', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov_key' })
            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author',
                authorEmail: 'author@test.com',
            })

            // External contributor with valid SSH signature but key not in envelope
            const contribKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'contrib_key' })
            await git.addSignedCommit({ repoDir, signingKeyPath: contribKey.privateKeyPath, authorName: 'Contributor', authorEmail: 'contrib@test.com', message: 'Unauthorized PR commit' })

            const result = await integrity.verify({
                repoDir,
                strict: { signersAllAuthorized: true },
            })
            expect(result.valid).toBe(false)
            expect(result.issues.some((i: string) => i.includes('not in Gordian envelope') || i.includes('invalid signatures') || i.includes('not authorized'))).toBe(true)
        })
    })
})

describe('Signature Classification — multiple contributors', function () {

    describe('two authorized contributors after key rotation', function () {

        const keysDir = `${workbenchDir}/sigclass-multicontrib-keys`
        const repoDir = `${workbenchDir}/sigclass-multicontrib-repo`

        it('should pass strict validation when both keys are in envelope via rotation', async function () {
            const key1 = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author1_key' })
            const key2 = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author2_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov_key' })

            const repoResult = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: key1.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author1',
                authorEmail: 'author1@test.com',
            })

            // Add commit with key1
            await git.addSignedCommit({ repoDir, signingKeyPath: key1.privateKeyPath, authorName: 'Author1', authorEmail: 'author1@test.com', message: 'Author1 work' })

            // Rotate to key2 — both keys now in provenance history
            await oi.rotateTrustSigningKey({
                repoDir,
                authorName: 'Author1',
                authorEmail: 'author1@test.com',
                existingSigningKeyPath: key1.privateKeyPath,
                newSigningKeyPath: key2.privateKeyPath,
                author: repoResult.author,
            })

            // Add commit with key2
            await git.addSignedCommit({ repoDir, signingKeyPath: key2.privateKeyPath, authorName: 'Author2', authorEmail: 'author2@test.com', message: 'Author2 work' })

            const result = await integrity.verify({
                repoDir,
                strict: { signersAllAuthorized: true },
            })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
            expect(result.totalCommits).toBeGreaterThanOrEqual(4)
        })
    })

    describe('authorized + unauthorized contributors in same repo', function () {

        const keysDir = `${workbenchDir}/sigclass-mixedcontrib-keys`
        const repoDir = `${workbenchDir}/sigclass-mixedcontrib-repo`

        it('should pass without strict, fail with strict when unauthorized contributor present', async function () {
            const authorKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov_key' })
            const unauthorizedKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'unauth_key' })

            await oi.createRepository({
                repoDir,
                firstTrustKeyPath: authorKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author',
                authorEmail: 'author@test.com',
            })

            // Authorized commit
            await git.addSignedCommit({ repoDir, signingKeyPath: authorKey.privateKeyPath, authorName: 'Author', authorEmail: 'author@test.com', message: 'Authorized work' })

            // Unauthorized external contributor (signed but key not in envelope)
            await git.addSignedCommit({ repoDir, signingKeyPath: unauthorizedKey.privateKeyPath, authorName: 'External', authorEmail: 'external@test.com', message: 'External PR' })

            // Without strict — should pass
            const resultNoStrict = await integrity.verify({ repoDir })
            expect(resultNoStrict.valid).toBe(true)

            // With strict — should fail
            const resultStrict = await integrity.verify({
                repoDir,
                strict: { signersAllAuthorized: true },
            })
            expect(resultStrict.valid).toBe(false)
        })
    })
})

describe('Signature Classification — auditSignatures cat-file fallback', function () {

    describe('unsigned commit has no gpgsig header', function () {

        const keysDir = `${workbenchDir}/sigclass-catfile-keys`
        const repoDir = `${workbenchDir}/sigclass-catfile-repo`

        it('should verify cat-file correctly identifies truly unsigned commits', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Author', authorEmail: 'author@test.com' })

            // Add unsigned commit
            await git.addUnsignedCommit({ repoDir, authorName: 'Unsigned', authorEmail: 'unsigned@test.com', message: 'No sig here' })

            // Get the hash
            const hashResult = await git.run({ args: ['rev-parse', 'HEAD'], cwd: repoDir })
            const hash = hashResult.stdout.trim()

            // Verify cat-file shows no gpgsig header
            const catResult = await git.run({ args: ['cat-file', '-p', hash], cwd: repoDir })
            expect(catResult.stdout).not.toContain('gpgsig ')

            // Now audit — should report the unsigned commit with status 'N'
            const audit = await git.auditSignatures({
                repoDir,
                allowedSigners: [{ email: 'author@test.com', publicKey: sigKey.publicKey }],
            })
            const unsignedCommit = audit.commits.find((c: any) => c.message === 'No sig here')
            expect(unsignedCommit).toBeDefined()
            expect(unsignedCommit.signatureStatus).toBe('N')
            expect(unsignedCommit.signatureValid).toBe(false)
        })
    })

    describe('signed commit with unknown key has gpgsig header', function () {

        const keysDir = `${workbenchDir}/sigclass-catfile-signed-keys`
        const repoDir = `${workbenchDir}/sigclass-catfile-signed-repo`

        it('should verify cat-file correctly identifies signed-but-unverifiable commits', async function () {
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'author_key' })
            const unknownKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'unknown_key' })
            await git.initRepo({ repoDir, signingKeyPath: sigKey.privateKeyPath, authorName: 'Author', authorEmail: 'author@test.com' })

            // Add commit signed with a key NOT in the allowed signers
            await git.addSignedCommit({ repoDir, signingKeyPath: unknownKey.privateKeyPath, authorName: 'Unknown', authorEmail: 'unknown@test.com', message: 'Unknown key commit' })

            // Get the hash
            const hashResult = await git.run({ args: ['rev-parse', 'HEAD'], cwd: repoDir })
            const hash = hashResult.stdout.trim()

            // Verify cat-file shows gpgsig header
            const catResult = await git.run({ args: ['cat-file', '-p', hash], cwd: repoDir })
            expect(catResult.stdout).toContain('gpgsig ')

            // Audit with only the author's key — unknownKey not in allowed signers
            const audit = await git.auditSignatures({
                repoDir,
                allowedSigners: [{ email: 'author@test.com', publicKey: sigKey.publicKey }],
            })
            const unknownCommit = audit.commits.find((c: any) => c.message === 'Unknown key commit')
            expect(unknownCommit).toBeDefined()
            expect(unknownCommit.signatureValid).toBe(false)
            // Should NOT be 'N' — the cat-file fallback should have corrected it
            expect(unknownCommit.signatureStatus).not.toBe('N')
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

