#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { $ } from 'bun'

const {
    test: { describe, it, expect, workbenchDir },
    oi,
    key,
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
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/GordianOpenIntegrity'
                },
                key: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/key'
                },
                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/fs'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/t44-blockchaincommons.com/examples/03-GordianOpenIntegrity'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

describe('Open Integrity + XID: Happy Path', function () {

    const keysDir = `${workbenchDir}/keys`
    const repoDir = `${workbenchDir}/repo`

    let author: any
    let publishedMark: string
    let publishedDocMark: string

    const DOC_PATH = '.o/example.com/policy/v1.yaml'
    const DOC_GEN_PATH = '.git/o/example.com/policy/v1-generator.yaml'

    // ──────────────────────────────────────────────────────────────
    // 1. AUTHOR: Create identity and repository
    // ──────────────────────────────────────────────────────────────

    describe('1. Author creates repository', function () {

        it('should create an inception repo with trust root', async function () {
            const inceptionKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'inception_ed25519' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'provenance_ed25519' })

            const result = await oi.createRepository({
                repoDir,
                firstTrustKeyPath: inceptionKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
                authorName: 'Author',
                authorEmail: 'author@example.com',
            })

            author = result.author
            expect(result.did).toStartWith('did:repo:')
            expect(result.mark).toBeDefined()

            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 2. VERIFIER: Verify repository
    // ──────────────────────────────────────────────────────────────

    describe('2. Verifier verifies repository', function () {

        it('should verify the repository with the published mark', async function () {
            const result = await oi.verify({ repoDir, mark: publishedMark })

            expect(result.valid).toBe(true)
            expect(result.marksMonotonic).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.validSignatures).toBe(result.totalCommits)
            expect(result.issues).toEqual([])
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 3. AUTHOR: Introduce a decision document
    // ──────────────────────────────────────────────────────────────

    describe('3. Author introduces a decision document', function () {

        it('should introduce a document linked to inception', async function () {
            const docKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'policy_key_ed25519' })
            const docProvKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'policy_provenance_ed25519' })
            const document = await oi.createDocument({
                documentKeyPath: docKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
            })

            const result = await oi.introduceDocument({
                repoDir,
                authorName: 'Author',
                authorEmail: 'author@example.com',
                trustKeyPath: author.sshKey.privateKeyPath,
                provenanceKeyPath: docProvKey.privateKeyPath,
                document,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN_PATH,
                label: 'initial-policy',
                author,
            })

            publishedDocMark = await oi.getMarkIdentifier({ mark: result.documentMark })
            publishedMark = await oi.getMarkIdentifier({ mark: result.inceptionMark })
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 4. VERIFIER: Verify the introduced document
    // ──────────────────────────────────────────────────────────────

    describe('4. Verifier verifies the document', function () {

        it('should verify the document with its published mark', async function () {
            const result = await oi.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
                mark: publishedDocMark,
            })

            expect(result.valid).toBe(true)
            expect(result.documentPathValid).toBe(true)
            expect(result.documentsMapValid).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
            expect(result.validSignatures).toBe(result.totalCommits)
            expect(result.invalidSignatures).toBe(0)
            expect(result.issues).toEqual([])
        })

        it('should still verify inception with the updated mark', async function () {
            const result = await oi.verify({ repoDir, mark: publishedMark })

            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })

        it('should pass git-level validation script', async function () {
            const scriptPath = await fs.resolve({ path: import.meta.dir, parts: ['../../bin/validate-git.sh'] })
            const result = await $`${scriptPath} --repo ${repoDir}`.nothrow()

            expect(result.exitCode).toBe(0)
            expect(result.stdout.toString()).toContain('Result: PASS')
        })
    })

})
