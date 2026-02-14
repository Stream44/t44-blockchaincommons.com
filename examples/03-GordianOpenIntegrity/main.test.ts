#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/workspace-rt'
import { join } from 'path'
import { rm, mkdir } from 'fs/promises'

const WORK_DIR = join(import.meta.dir, '.~open-integrity-xid')

const {
    test: { describe, it, expect },
    oi,
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

await rm(WORK_DIR, { recursive: true, force: true })
await mkdir(WORK_DIR, { recursive: true })

// ════════════════════════════════════════════════════════════════════════
//
//  Open Integrity + XID — Happy-Path Example
//
//  Demonstrates the simplest ideal workflow:
//    1. Author creates identity and repository
//    2. Verifier verifies the repository with a published mark
//    3. Author introduces a decision document
//    4. Verifier verifies the document
//
// ════════════════════════════════════════════════════════════════════════

describe('Open Integrity + XID: Happy Path', function () {

    const keysDir = join(WORK_DIR, 'keys')
    const repoDir = join(WORK_DIR, 'repo')

    let author: any
    let publishedMark: string
    let publishedDocMark: string

    const DOC_PATH = '.o/example.com/policy/v1.yaml'
    const DOC_GEN_PATH = '.git/o/example.com/policy/v1-generator.yaml'

    // ──────────────────────────────────────────────────────────────
    // 1. AUTHOR: Create identity and repository
    // ──────────────────────────────────────────────────────────────

    describe('1. Author creates identity and repository', function () {

        it('should create an XID identity and inception repo', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'Author',
                authorEmail: 'author@example.com',
                provenancePassphrase: 'open-integrity-xid-example',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })

            const result = await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })

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
            const document = await oi.createDocument({
                provenancePassphrase: 'policy-doc-v1',
                provenanceDate: new Date(Date.UTC(2025, 0, 2)),
            })

            const result = await oi.introduceDocument({
                repoDir,
                author,
                document,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN_PATH,
                date: new Date(Date.UTC(2025, 0, 2)),
                label: 'initial-policy',
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
    })

})
