#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/workspace-rt'
import { join } from 'path'
import { rm, mkdir, readFile } from 'fs/promises'

const WORK_DIR = join(import.meta.dir, '.~open-integrity')

const {
    test: { describe, it, expect },
    js,
    sh
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
                js: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './open-integrity-js'
                },
                sh: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './open-integrity-sh'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/open-integrity.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

// Clean up before tests
await rm(WORK_DIR, { recursive: true, force: true })
await mkdir(WORK_DIR, { recursive: true })

describe('Open Integrity: JS vs SH Cross-Validation', function () {

    const keysDir = join(WORK_DIR, 'keys')
    const shGenRepoDir = join(WORK_DIR, 'repo-sh-gen')
    const jsGenRepoDir = join(WORK_DIR, 'repo-js-gen')
    const jsOnlyRepoDir = join(WORK_DIR, 'repo-js-only')

    let aliceKey: any
    let bobKey: any
    let jsInception: any

    // ──────────────────────────────────────────────────────────────────
    // PART A: Common features — SH generates, JS validates
    // ──────────────────────────────────────────────────────────────────

    describe('A. SH generates → JS validates', function () {

        it('should create inception repo via SH (setup_git_inception_repo.sh)', async function () {
            const result = await sh.createInceptionRepo({ repoDir: shGenRepoDir })
            expect(result.exitCode).toBe(0)
        })

        it('JS getRepoDid should read DID from SH-created repo', async function () {
            const did = await js.getRepoDid({ repoDir: shGenRepoDir })
            expect(did).toStartWith('did:repo:')
        })

        it('JS getInceptionCommit should inspect SH-created inception commit', async function () {
            const inception = await js.getInceptionCommit({ repoDir: shGenRepoDir })
            expect(inception.commitHash.length).toBe(40)
            expect(inception.did).toStartWith('did:repo:')
            expect(inception.fullDetails).toContain('Initialize repository')
        })

        it('JS auditRepository should pass on SH-created repo', async function () {
            // Read the SH signing public key so JS can verify
            const shPubKeyPath = join(require('os').tmpdir(), '.open-integrity-sh-signing', 'signing_key_ed25519.pub')
            const shPubKey = (await readFile(shPubKeyPath, 'utf-8')).trim()

            const audit = await js.auditRepository({
                repoDir: shGenRepoDir,
                allowedSigners: [{ email: 'oi-sh@test.local', publicKey: shPubKey }],
            })
            expect(audit.totalCommits).toBe(1)
            expect(audit.inceptionCommitEmpty).toBe(true)
            expect(audit.did).toStartWith('did:repo:')
        })

        it('JS and SH should agree on the DID', async function () {
            const jsDid = await js.getRepoDid({ repoDir: shGenRepoDir })
            const shDid = await sh.getRepoDid({ repoDir: shGenRepoDir })
            expect(jsDid).toBe(shDid)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // PART B: Common features — JS generates, SH validates
    // ──────────────────────────────────────────────────────────────────

    describe('B. JS generates → SH validates', function () {

        it('should generate a signing key via JS', async function () {
            aliceKey = await js.generateSigningKey({
                keyDir: keysDir,
                keyName: 'alice_ed25519',
                passphrase: '',
            })
            expect(aliceKey.publicKey).toContain('ssh-ed25519')
        })

        it('should create inception repo via JS (createInceptionCommit)', async function () {
            jsInception = await js.createInceptionCommit({
                repoDir: jsGenRepoDir,
                signingKeyPath: aliceKey.privateKeyPath,
                authorName: '@Alice',
                authorEmail: 'alice@example.com',
            })
            expect(jsInception.commitHash.length).toBe(40)
            expect(jsInception.did).toStartWith('did:repo:')
        })

        it('SH getRepoDid should read DID from JS-created repo', async function () {
            const did = await sh.getRepoDid({ repoDir: jsGenRepoDir })
            expect(did).toBe(jsInception.did)
        })

        it('SH auditInceptionCommit should fail on JS-created repo (different signing key)', async function () {
            // The SH audit uses its own signing key, not Alice's key,
            // so it correctly fails to verify the JS-created inception commit.
            const audit = await sh.auditInceptionCommit({
                repoDir: jsGenRepoDir,
                quiet: true,
                noPrompt: true,
                noColor: true,
            })
            expect(audit.passed).toBe(false)
            expect(audit.exitCode).not.toBe(0)
        })

        it('JS and SH should agree on the DID', async function () {
            const jsDid = await js.getRepoDid({ repoDir: jsGenRepoDir })
            const shDid = await sh.getRepoDid({ repoDir: jsGenRepoDir })
            expect(jsDid).toBe(shDid)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // PART C: JS-only features, then SH re-validates
    // ──────────────────────────────────────────────────────────────────

    describe('C. JS-only features → SH re-validates', function () {

        it('should generate a second signing key (Bob)', async function () {
            bobKey = await js.generateSigningKey({
                keyDir: keysDir,
                keyName: 'bob_ed25519',
                passphrase: '',
            })
            expect(bobKey.publicKey).toContain('ssh-ed25519')
            expect(bobKey.fingerprint).not.toBe(aliceKey.fingerprint)
        })

        it('should create inception repo for JS-only workflow', async function () {
            const inception = await js.createInceptionCommit({
                repoDir: jsOnlyRepoDir,
                signingKeyPath: aliceKey.privateKeyPath,
                authorName: '@Alice',
                authorEmail: 'alice@example.com',
            })
            expect(inception.commitHash.length).toBe(40)
        })

        it('should verify inception commit with allowedSigners', async function () {
            const result = await js.verifyInceptionCommit({
                repoDir: jsOnlyRepoDir,
                allowedSigners: [{ email: 'alice@example.com', publicKey: aliceKey.publicKey }],
            })
            expect(result.valid).toBe(true)
        })

        it('should allow Bob to create a signed commit', async function () {
            const result = await js.createSignedCommit({
                repoDir: jsOnlyRepoDir,
                signingKeyPath: bobKey.privateKeyPath,
                message: 'Bob adds feature',
                authorName: '@Bob',
                authorEmail: 'bob@example.com',
                allowEmpty: true,
            })
            expect(result.commitHash).toBeDefined()
        })

        it('should verify Bob\'s commit with allowedSigners', async function () {
            const result = await js.verifyCommit({
                repoDir: jsOnlyRepoDir,
                allowedSigners: [
                    { email: 'alice@example.com', publicKey: aliceKey.publicKey },
                    { email: 'bob@example.com', publicKey: bobKey.publicKey },
                ],
            })
            expect(result.valid).toBe(true)
        })

        it('should list all 2 commits', async function () {
            const result = await js.listCommits({ repoDir: jsOnlyRepoDir, reverse: true })
            expect(result.count).toBe(2)
            expect(result.commits[0].message).toBe('[GordianOpenIntegrity] Establish a SHA-1 root of trust for origin and future commit verification.')
            expect(result.commits[1].message).toBe('Bob adds feature')
        })

        it('should get latest commit details', async function () {
            const details = await js.getCommitDetails({ repoDir: jsOnlyRepoDir })
            expect(details.message).toBe('Bob adds feature')
        })

        it('JS auditRepository should pass with allowedSigners', async function () {
            const audit = await js.auditRepository({
                repoDir: jsOnlyRepoDir,
                allowedSigners: [
                    { email: 'alice@example.com', publicKey: aliceKey.publicKey },
                    { email: 'bob@example.com', publicKey: bobKey.publicKey },
                ],
            })
            expect(audit.totalCommits).toBe(2)
            expect(audit.validSignatures).toBe(2)
            expect(audit.invalidSignatures).toBe(0)
            expect(audit.inceptionCommitValid).toBe(true)
            expect(audit.inceptionCommitEmpty).toBe(true)
        })

        // SH re-validates the repo after all JS-only mutations

        it('SH getRepoDid should still work after JS-only operations', async function () {
            const did = await sh.getRepoDid({ repoDir: jsOnlyRepoDir })
            expect(did).toStartWith('did:repo:')
        })

        it('JS and SH should agree on the DID after all mutations', async function () {
            const jsDid = await js.getRepoDid({ repoDir: jsOnlyRepoDir })
            const shDid = await sh.getRepoDid({ repoDir: jsOnlyRepoDir })
            expect(jsDid).toBe(shDid)
        })
    })

})
