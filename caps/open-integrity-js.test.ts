#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { rm, mkdir, readFile } from 'fs/promises'

const WORK_DIR = join(import.meta.dir, '.~open-integrity-js')

const {
    test: { describe, it, expect },
    oi
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
                    value: './open-integrity-js'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/open-integrity-js.test'
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

describe('Open Integrity JS Lifecycle', function () {

    const keysDir = join(WORK_DIR, 'keys')
    const repoDir = join(WORK_DIR, 'test-repo')

    let aliceKey: any
    let bobKey: any
    let inceptionResult: any

    describe('1. Key Generation', function () {

        it('should generate an SSH signing key for Alice', async function () {
            aliceKey = await oi.generateSigningKey({
                keyDir: keysDir,
                keyName: 'alice_ed25519',
                passphrase: '',
            })

            expect(aliceKey.privateKeyPath).toContain('alice_ed25519')
            expect(aliceKey.publicKeyPath).toContain('alice_ed25519.pub')
            expect(aliceKey.publicKey).toContain('ssh-ed25519')
            expect(aliceKey.fingerprint).toContain('SHA256:')
        })

        it('should generate an SSH signing key for Bob', async function () {
            bobKey = await oi.generateSigningKey({
                keyDir: keysDir,
                keyName: 'bob_ed25519',
                passphrase: '',
            })

            expect(bobKey.publicKey).toContain('ssh-ed25519')
            expect(bobKey.fingerprint).not.toBe(aliceKey.fingerprint)
        })
    })

    describe('2. Inception Commit (Root of Trust)', function () {

        it('should create a repo with a signed inception commit', async function () {
            inceptionResult = await oi.createInceptionCommit({
                repoDir,
                signingKeyPath: aliceKey.privateKeyPath,
                authorName: '@Alice',
                authorEmail: 'alice@example.com',
            })

            expect(inceptionResult.commitHash).toBeDefined()
            expect(inceptionResult.commitHash.length).toBe(40)
            expect(inceptionResult.did).toStartWith('did:repo:')
            expect(inceptionResult.fingerprint).toContain('SHA256:')
        })

        it('should have an empty tree in the inception commit', async function () {
            const details = await oi.getCommitDetails({ repoDir })
            expect(details.message).toBe('[GordianOpenIntegrity] Establish a SHA-1 root of trust for origin and future commit verification.')
            expect(details.authorName).toBe('@Alice')
            // Committer name should be the key fingerprint
            expect(details.committerName).toContain('SHA256:')
        })
    })

    describe('3. Repository DID', function () {

        it('should retrieve the repo DID from the inception commit', async function () {
            const did = await oi.getRepoDid({ repoDir })
            expect(did).toBe(inceptionResult.did)
            expect(did).toStartWith('did:repo:')
        })
    })

    describe('4. Inception Commit Inspection', function () {

        it('should retrieve inception commit details', async function () {
            const inception = await oi.getInceptionCommit({ repoDir })

            expect(inception.commitHash).toBe(inceptionResult.commitHash)
            expect(inception.did).toBe(inceptionResult.did)
            expect(inception.fullDetails).toContain('Establish a SHA-1 root of trust')
            expect(inception.committer).toContain('SHA256:')
        })
    })

    describe('5. Commit Details Inspection', function () {

        it('should get detailed commit information', async function () {
            const details = await oi.getCommitDetails({
                repoDir,
                commitHash: inceptionResult.commitHash,
            })

            expect(details.commitHash).toBe(inceptionResult.commitHash)
            expect(details.authorName).toBe('@Alice')
            expect(details.authorEmail).toBe('alice@example.com')
            expect(details.message).toBe('[GordianOpenIntegrity] Establish a SHA-1 root of trust for origin and future commit verification.')
            expect(details.fullDetails).toContain('Signed-off-by')
            expect(details.fullDetails).toContain('Trust established using')
        })
    })

    describe('6. createSignedCommit', function () {

        it('should commit a single file', async function () {
            const result = await oi.createSignedCommit({
                repoDir,
                signingKeyPath: aliceKey.privateKeyPath,
                message: 'Add provenance document',
                authorName: '@Alice',
                authorEmail: 'alice@example.com',
                files: [{
                    path: '.o/workspace.foundation/provenance.json',
                    content: JSON.stringify({ xid: 'test-xid-123' }, null, 2),
                }],
            })

            expect(result.commitHash).toBeDefined()
            expect(result.commitHash.length).toBe(40)
            expect(result.message).toBe('Add provenance document')

            const content = await readFile(join(repoDir, '.o/workspace.foundation/provenance.json'), 'utf-8')
            expect(JSON.parse(content).xid).toBe('test-xid-123')
        })

        it('should commit multiple files at once', async function () {
            const result = await oi.createSignedCommit({
                repoDir,
                signingKeyPath: aliceKey.privateKeyPath,
                message: 'Add multiple files',
                authorName: '@Alice',
                authorEmail: 'alice@example.com',
                files: [
                    { path: 'docs/README.md', content: '# Hello\n' },
                    { path: 'docs/CHANGELOG.md', content: '# Changes\n' },
                ],
            })

            expect(result.commitHash).toBeDefined()

            const readme = await readFile(join(repoDir, 'docs/README.md'), 'utf-8')
            expect(readme).toBe('# Hello\n')

            const changelog = await readFile(join(repoDir, 'docs/CHANGELOG.md'), 'utf-8')
            expect(changelog).toBe('# Changes\n')
        })

        it('should create an empty commit with allowEmpty', async function () {
            const result = await oi.createSignedCommit({
                repoDir,
                signingKeyPath: aliceKey.privateKeyPath,
                message: 'Empty checkpoint commit',
                authorName: '@Alice',
                authorEmail: 'alice@example.com',
                allowEmpty: true,
            })

            expect(result.commitHash).toBeDefined()
            expect(result.message).toBe('Empty checkpoint commit')
        })

        it('should update an existing file in place', async function () {
            const result = await oi.createSignedCommit({
                repoDir,
                signingKeyPath: aliceKey.privateKeyPath,
                message: 'Update provenance document',
                authorName: '@Alice',
                authorEmail: 'alice@example.com',
                files: [{
                    path: '.o/workspace.foundation/provenance.json',
                    content: JSON.stringify({ xid: 'test-xid-123', version: 2 }, null, 2),
                }],
            })

            expect(result.commitHash).toBeDefined()

            const content = await readFile(join(repoDir, '.o/workspace.foundation/provenance.json'), 'utf-8')
            const parsed = JSON.parse(content)
            expect(parsed.xid).toBe('test-xid-123')
            expect(parsed.version).toBe(2)
        })
    })

    describe('7. Commit History & Audit', function () {

        it('should list all commits in chronological order', async function () {
            const listResult = await oi.listCommits({ repoDir, reverse: true })

            expect(listResult.count).toBe(5) // inception + 4 createSignedCommit
            expect(listResult.commits[0].message).toBe('[GordianOpenIntegrity] Establish a SHA-1 root of trust for origin and future commit verification.')
        })

        it('should audit the full repository', async function () {
            const auditResult = await oi.auditRepository({
                repoDir,
                allowedSigners: [{ email: 'alice@example.com', publicKey: aliceKey.publicKey }],
            })

            expect(auditResult.totalCommits).toBe(5)
            expect(auditResult.inceptionCommitValid).toBe(true)
            expect(auditResult.inceptionCommitEmpty).toBe(true)
            expect(auditResult.did).toStartWith('did:repo:')
        })
    })

})
