#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { rm, mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

const WORK_DIR = join(import.meta.dir, '.~gordian-open-integrity')

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
                    value: './GordianOpenIntegrity'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/GordianOpenIntegrity.test'
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
//  GordianOpenIntegrity — Comprehensive Unit Tests
//
// ════════════════════════════════════════════════════════════════════════

describe('GordianOpenIntegrity', function () {

    // ──────────────────────────────────────────────────────────────
    // 1. createIdentity
    // ──────────────────────────────────────────────────────────────

    describe('1. createIdentity', function () {

        const keysDir = join(WORK_DIR, 'identity-keys')

        it('should create an identity with SSH key and XID document', async function () {
            const author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'Alice',
                authorEmail: 'alice@example.com',
                provenancePassphrase: 'test-passphrase',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })

            expect(author.sshKey.publicKey).toContain('ssh-ed25519')
            expect(author.sshKey.fingerprint).toContain('SHA256:')
            expect(author.sshKey.privateKeyPath).toBeDefined()
            expect(author.document).toBeDefined()
            expect(author.keyBase).toBeDefined()
            expect(author.authorName).toBe('Alice')
            expect(author.authorEmail).toBe('alice@example.com')
        })

        it('should use default key name when not specified', async function () {
            const keysDir2 = join(WORK_DIR, 'identity-keys-default')
            const author = await oi.createIdentity({
                keyDir: keysDir2,
                authorName: 'Bob',
                authorEmail: 'bob@example.com',
            })

            expect(author.sshKey.privateKeyPath).toContain('signing_ed25519')
        })

        it('should use custom key name', async function () {
            const keysDir3 = join(WORK_DIR, 'identity-keys-custom')
            const author = await oi.createIdentity({
                keyDir: keysDir3,
                keyName: 'my_custom_key',
                authorName: 'Carol',
                authorEmail: 'carol@example.com',
            })

            expect(author.sshKey.privateKeyPath).toContain('my_custom_key')
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 2. createDocument
    // ──────────────────────────────────────────────────────────────

    describe('2. createDocument', function () {

        it('should create a standalone XID document', async function () {
            const doc = await oi.createDocument({
                provenancePassphrase: 'doc-passphrase',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })

            expect(doc).toBeDefined()
        })

        it('should use default passphrase when not specified', async function () {
            const doc = await oi.createDocument({})
            expect(doc).toBeDefined()
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 3. createRepository
    // ──────────────────────────────────────────────────────────────

    describe('3. createRepository', function () {

        const keysDir = join(WORK_DIR, 'repo-keys')
        const repoDir = join(WORK_DIR, 'repo-create')
        let author: any
        let publishedMark: string

        it('should create an identity for repo tests', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'RepoAuthor',
                authorEmail: 'repo@example.com',
                provenancePassphrase: 'repo-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            expect(author.document).toBeDefined()
        })

        it('should create a repository with inception commit and provenance', async function () {
            const result = await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })

            expect(result.commitHash).toBeDefined()
            expect(result.commitHash.length).toBe(40)
            expect(result.did).toStartWith('did:repo:')
            expect(result.mark).toBeDefined()

            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
            expect(publishedMark).toBeDefined()
        })

        it('should write GordianOpenIntegrity.yaml as valid JSON Schema', async function () {
            const yaml = await readFile(join(repoDir, '.o/GordianOpenIntegrity.yaml'), 'utf-8')
            const jsonBlock = yaml.split('\n---')[0]
            const doc = JSON.parse(jsonBlock)
            expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
            expect(doc.envelope).toContain('ur:envelope/')
            expect(doc.mark).toBeDefined()
            expect(doc.$defs.envelope.$ref).toBe('https://datatracker.ietf.org/doc/draft-mcnally-envelope/')
            expect(doc.$defs.mark.$ref).toContain('bcr-2025-001-provenance-mark.md')
        })

        it('should include SSH key assertion in GordianOpenIntegrity.yaml', async function () {
            const yaml = await readFile(join(repoDir, '.o/GordianOpenIntegrity.yaml'), 'utf-8')
            expect(yaml).toContain('"GordianOpenIntegrity"')
            expect(yaml).toContain('ssh-ed25519')
        })

        it('should include human-readable envelope after ---', async function () {
            const yaml = await readFile(join(repoDir, '.o/GordianOpenIntegrity.yaml'), 'utf-8')
            expect(yaml).toContain('---')
            expect(yaml).toContain('# XID(')
        })

        it('should store generator state in .git (never committed)', async function () {
            expect(existsSync(join(repoDir, '.git/o/GordianOpenIntegrity-generator.yaml'))).toBe(true)
        })

        it('should write inception lifehash SVG', async function () {
            const svgPath = join(repoDir, '.o/GordianOpenIntegrity-InceptionLifehash.svg')
            expect(existsSync(svgPath)).toBe(true)
            const svg = await readFile(svgPath, 'utf-8')
            expect(svg.length).toBeGreaterThan(0)
            expect(svg).toContain('<svg')
        })

        it('should write current lifehash SVG (same as inception initially)', async function () {
            const svgPath = join(repoDir, '.o/GordianOpenIntegrity-CurrentLifehash.svg')
            expect(existsSync(svgPath)).toBe(true)
            const inception = await readFile(join(repoDir, '.o/GordianOpenIntegrity-InceptionLifehash.svg'), 'utf-8')
            const current = await readFile(svgPath, 'utf-8')
            expect(current).toBe(inception)
        })

        it('should create a ledger with correct labels', async function () {
            const labels = await oi.getLedgerLabels({ author })
            expect(labels).toEqual(['genesis', 'link-ssh-key'])
        })

        it('should use custom message and contract', async function () {
            const customRepoDir = join(WORK_DIR, 'repo-custom-msg')
            const customKeysDir = join(WORK_DIR, 'repo-custom-msg-keys')
            const customAuthor = await oi.createIdentity({
                keyDir: customKeysDir,
                authorName: 'Custom',
                authorEmail: 'custom@example.com',
            })

            const result = await oi.createRepository({
                repoDir: customRepoDir,
                author: customAuthor,
                message: 'Custom inception message',
                contract: 'Custom Ricardian contract text.',
            })

            expect(result.commitHash.length).toBe(40)
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 4. verify (inception)
    // ──────────────────────────────────────────────────────────────

    describe('4. verify', function () {

        const keysDir = join(WORK_DIR, 'verify-keys')
        const repoDir = join(WORK_DIR, 'repo-verify')
        let author: any
        let publishedMark: string

        it('should set up a repo for verification', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'Verifier',
                authorEmail: 'verifier@example.com',
                provenancePassphrase: 'verify-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            const result = await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })
            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should verify a valid repository with correct mark', async function () {
            const result = await oi.verify({ repoDir, mark: publishedMark })

            expect(result.valid).toBe(true)
            expect(result.marksMonotonic).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.validSignatures).toBe(result.totalCommits)
            expect(result.invalidSignatures).toBe(0)
            expect(result.did).toStartWith('did:repo:')
            expect(result.xid).toBeDefined()
            expect(result.provenanceVersions).toBe(1)
            expect(result.issues).toEqual([])
        })

        it('should verify without a mark (no mark match check)', async function () {
            const result = await oi.verify({ repoDir })

            expect(result.valid).toBe(true)
            expect(result.marksMonotonic).toBe(true)
            expect(result.xid).toBeDefined()
        })

        it('should fail verification with wrong mark', async function () {
            const result = await oi.verify({ repoDir, mark: 'wrong-mark-id' })

            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 5. rotateKey
    // ──────────────────────────────────────────────────────────────

    describe('5. rotateKey', function () {

        const keysDir = join(WORK_DIR, 'rotate-keys')
        const repoDir = join(WORK_DIR, 'repo-rotate')
        let author: any
        let publishedMark: string

        it('should set up a repo for key rotation', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'Rotator',
                authorEmail: 'rotator@example.com',
                provenancePassphrase: 'rotate-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            const result = await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })
            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should rotate to a new signing key', async function () {
            const oldFingerprint = author.sshKey.fingerprint

            const result = await oi.rotateKey({
                repoDir,
                author,
                keyName: 'rotated_key',
                date: new Date(Date.UTC(2025, 0, 2)),
            })

            author = result.author
            expect(result.newFingerprint).toContain('SHA256:')
            expect(result.newFingerprint).not.toBe(oldFingerprint)
            expect(result.mark).toBeDefined()

            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should update current lifehash SVG after rotation', async function () {
            const inceptionSvg = await readFile(join(repoDir, '.o/GordianOpenIntegrity-InceptionLifehash.svg'), 'utf-8')
            const currentSvg = await readFile(join(repoDir, '.o/GordianOpenIntegrity-CurrentLifehash.svg'), 'utf-8')
            expect(currentSvg).not.toBe(inceptionSvg)
        })

        it('should only show the rotated SSH key in GordianOpenIntegrity.yaml', async function () {
            const yaml = await readFile(join(repoDir, '.o/GordianOpenIntegrity.yaml'), 'utf-8')
            // Should have exactly one GordianOpenIntegrity assertion
            const matches = yaml.match(/"GordianOpenIntegrity"/g) || []
            expect(matches.length).toBe(1)
            expect(yaml).toContain(author.sshKey.publicKey)
        })

        it('should have correct ledger labels after rotation', async function () {
            const labels = await oi.getLedgerLabels({ author })
            expect(labels).toEqual([
                'genesis',
                'link-ssh-key',
                'add-rotated-key',
                'remove-inception-key',
            ])
        })

        it('should verify after key rotation with new mark', async function () {
            const result = await oi.verify({ repoDir, mark: publishedMark })

            expect(result.valid).toBe(true)
            expect(result.marksMonotonic).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.provenanceVersions).toBe(2)
            expect(result.issues).toEqual([])
        })

        it('should fail verification with the old mark after rotation', async function () {
            // The old mark no longer matches the latest provenance
            const result = await oi.verify({ repoDir, mark: 'stale-old-mark' })

            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
        })

        it('should pass ledger verification after rotation', async function () {
            const result = await oi.verifyLedger({ author })
            expect(result.valid).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.genesisPresent).toBe(true)
            expect(result.chainIntact).toBe(true)
            expect(result.sequenceValid).toBe(true)
            expect(result.datesMonotonic).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 6. introduceDocument
    // ──────────────────────────────────────────────────────────────

    describe('6. introduceDocument', function () {

        const keysDir = join(WORK_DIR, 'doc-keys')
        const repoDir = join(WORK_DIR, 'repo-doc')
        let author: any
        let publishedMark: string
        let publishedDocMark: string
        let documentLedger: any

        const DOC_PATH = '.o/decisions/policy-v1.yaml'
        const DOC_GEN_PATH = '.git/o/decisions/policy-v1-generator.yaml'

        it('should set up a repo for document introduction', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'DocAuthor',
                authorEmail: 'doc@example.com',
                provenancePassphrase: 'doc-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            const result = await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })
            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should introduce a document linked to inception', async function () {
            const doc = await oi.createDocument({
                provenancePassphrase: 'policy-doc',
                provenanceDate: new Date(Date.UTC(2025, 0, 2)),
            })

            const result = await oi.introduceDocument({
                repoDir,
                author,
                document: doc,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN_PATH,
                date: new Date(Date.UTC(2025, 0, 2)),
                label: 'initial-policy',
            })

            documentLedger = result.documentLedger
            expect(result.document).toBeDefined()
            expect(result.inceptionMark).toBeDefined()
            expect(result.documentMark).toBeDefined()

            publishedDocMark = await oi.getMarkIdentifier({ mark: result.documentMark })
            publishedMark = await oi.getMarkIdentifier({ mark: result.inceptionMark })
        })

        it('should write document provenance as valid JSON Schema', async function () {
            const yaml = await readFile(join(repoDir, DOC_PATH), 'utf-8')
            const jsonBlock = yaml.split('\n---')[0]
            const doc = JSON.parse(jsonBlock)
            expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
            expect(doc.envelope).toContain('ur:envelope/')
            expect(doc.mark).toBeDefined()
        })

        it('should store Document assertion in the document yaml', async function () {
            const docYaml = await readFile(join(repoDir, DOC_PATH), 'utf-8')
            expect(docYaml).toContain('"GordianOpenIntegrity.Document"')
            expect(docYaml).toContain(DOC_PATH)
        })

        it('should NOT store Document assertion on GordianOpenIntegrity yaml', async function () {
            const inceptionYaml = await readFile(join(repoDir, '.o/GordianOpenIntegrity.yaml'), 'utf-8')
            expect(inceptionYaml).not.toContain('"GordianOpenIntegrity.Document"')
        })

        it('should update current lifehash SVG after document introduction', async function () {
            const inceptionSvg = await readFile(join(repoDir, '.o/GordianOpenIntegrity-InceptionLifehash.svg'), 'utf-8')
            const currentSvg = await readFile(join(repoDir, '.o/GordianOpenIntegrity-CurrentLifehash.svg'), 'utf-8')
            expect(currentSvg).not.toBe(inceptionSvg)
        })

        it('should store Documents map in GordianOpenIntegrity yaml', async function () {
            const inceptionYaml = await readFile(join(repoDir, '.o/GordianOpenIntegrity.yaml'), 'utf-8')
            expect(inceptionYaml).toContain('"GordianOpenIntegrity.Documents"')
            expect(inceptionYaml).toContain(DOC_PATH)
        })

        it('should store document generator in .git', async function () {
            expect(existsSync(join(repoDir, DOC_GEN_PATH))).toBe(true)
        })

        it('should have correct inception ledger labels', async function () {
            const labels = await oi.getLedgerLabels({ author })
            expect(labels).toContain(`introduce:${DOC_PATH}`)
        })

        it('should have correct document ledger labels', async function () {
            const labels = await oi.getDocumentLedgerLabels({ documentLedger })
            expect(labels).toEqual(['genesis', 'initial-policy'])
        })

        it('should pass inception ledger verification', async function () {
            const result = await oi.verifyLedger({ author })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })

        it('should pass document ledger verification', async function () {
            const result = await oi.verifyDocumentLedger({ documentLedger })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 7. verifyDocument
    // ──────────────────────────────────────────────────────────────

    describe('7. verifyDocument', function () {

        const keysDir = join(WORK_DIR, 'verdoc-keys')
        const repoDir = join(WORK_DIR, 'repo-verdoc')
        let author: any
        let publishedMark: string
        let publishedDocMark: string

        const DOC_PATH = '.o/org/charter.yaml'
        const DOC_GEN_PATH = '.git/o/org/charter-generator.yaml'

        it('should set up repo with an introduced document', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'VerDocAuthor',
                authorEmail: 'verdoc@example.com',
                provenancePassphrase: 'verdoc-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            const repoResult = await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })
            publishedMark = await oi.getMarkIdentifier({ mark: repoResult.mark })

            const doc = await oi.createDocument({
                provenancePassphrase: 'charter-doc',
                provenanceDate: new Date(Date.UTC(2025, 0, 2)),
            })
            const docResult = await oi.introduceDocument({
                repoDir,
                author,
                document: doc,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN_PATH,
                date: new Date(Date.UTC(2025, 0, 2)),
            })
            publishedDocMark = await oi.getMarkIdentifier({ mark: docResult.documentMark })
            publishedMark = await oi.getMarkIdentifier({ mark: docResult.inceptionMark })
        })

        it('should verify a document with correct mark', async function () {
            const result = await oi.verifyDocument({
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
            expect(result.validSignatures).toBe(result.totalCommits)
            expect(result.invalidSignatures).toBe(0)
            expect(result.provenanceVersions).toBe(1)
            expect(result.issues).toEqual([])
        })

        it('should verify a document without a mark', async function () {
            const result = await oi.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
            })

            expect(result.valid).toBe(true)
            expect(result.documentPathValid).toBe(true)
            expect(result.documentsMapValid).toBe(true)
            expect(result.validSignatures).toBe(result.totalCommits)
            expect(result.invalidSignatures).toBe(0)
        })

        it('should fail verification with wrong mark', async function () {
            const result = await oi.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
                mark: 'wrong-mark',
            })

            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
            expect(result.issues.length).toBeGreaterThan(0)
        })

        it('should fail verification for non-existent document path', async function () {
            const result = await oi.verifyDocument({
                repoDir,
                documentPath: '.o/nonexistent.yaml',
            })

            expect(result.valid).toBe(false)
            expect(result.issues).toContain('No provenance documents found at .o/nonexistent.yaml')
        })

        it('should still verify inception after document introduction', async function () {
            const result = await oi.verify({ repoDir, mark: publishedMark })

            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 8. commitToRepository
    // ──────────────────────────────────────────────────────────────

    describe('8. commitToRepository', function () {

        const keysDir = join(WORK_DIR, 'commit-keys')
        const repoDir = join(WORK_DIR, 'repo-commit')
        let author: any
        let publishedMark: string

        it('should set up a repo for commit tests', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'Committer',
                authorEmail: 'committer@example.com',
                provenancePassphrase: 'commit-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            const result = await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })
            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should create a signed commit with files', async function () {
            await oi.commitToRepository({
                repoDir,
                author,
                message: 'Add a new file',
                files: [{ path: 'README.md', content: '# Hello\n' }],
            })

            const content = await readFile(join(repoDir, 'README.md'), 'utf-8')
            expect(content).toBe('# Hello\n')
        })

        it('should still verify after additional commits', async function () {
            const result = await oi.verify({ repoDir, mark: publishedMark })

            expect(result.valid).toBe(true)
            expect(result.totalCommits).toBeGreaterThan(2)
            expect(result.issues).toEqual([])
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 9. Multiple documents
    // ──────────────────────────────────────────────────────────────

    describe('9. Multiple documents', function () {

        const keysDir = join(WORK_DIR, 'multi-keys')
        const repoDir = join(WORK_DIR, 'repo-multi')
        let author: any

        const DOC1_PATH = '.o/docs/alpha.yaml'
        const DOC1_GEN = '.git/o/docs/alpha-generator.yaml'
        const DOC2_PATH = '.o/docs/beta.yaml'
        const DOC2_GEN = '.git/o/docs/beta-generator.yaml'

        it('should set up a repo', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'MultiAuthor',
                authorEmail: 'multi@example.com',
                provenancePassphrase: 'multi-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })
        })

        it('should introduce first document', async function () {
            const doc1 = await oi.createDocument({
                provenancePassphrase: 'alpha-doc',
                provenanceDate: new Date(Date.UTC(2025, 0, 2)),
            })
            const result = await oi.introduceDocument({
                repoDir,
                author,
                document: doc1,
                documentPath: DOC1_PATH,
                generatorPath: DOC1_GEN,
                date: new Date(Date.UTC(2025, 0, 2)),
                label: 'alpha',
            })
        })

        it('should introduce second document', async function () {
            const doc2 = await oi.createDocument({
                provenancePassphrase: 'beta-doc',
                provenanceDate: new Date(Date.UTC(2025, 0, 3)),
            })
            const result = await oi.introduceDocument({
                repoDir,
                author,
                document: doc2,
                documentPath: DOC2_PATH,
                generatorPath: DOC2_GEN,
                date: new Date(Date.UTC(2025, 0, 3)),
                label: 'beta',
            })
        })

        it('should have Documents map with both paths', async function () {
            const inceptionYaml = await readFile(join(repoDir, '.o/GordianOpenIntegrity.yaml'), 'utf-8')
            expect(inceptionYaml).toContain(DOC1_PATH)
            expect(inceptionYaml).toContain(DOC2_PATH)
        })

        it('should verify first document', async function () {
            const result = await oi.verifyDocument({
                repoDir,
                documentPath: DOC1_PATH,
            })
            expect(result.valid).toBe(true)
            expect(result.documentPathValid).toBe(true)
            expect(result.documentsMapValid).toBe(true)
        })

        it('should verify second document', async function () {
            const result = await oi.verifyDocument({
                repoDir,
                documentPath: DOC2_PATH,
            })
            expect(result.valid).toBe(true)
            expect(result.documentPathValid).toBe(true)
            expect(result.documentsMapValid).toBe(true)
        })

        it('should have correct inception ledger labels', async function () {
            const labels = await oi.getLedgerLabels({ author })
            expect(labels).toContain(`introduce:${DOC1_PATH}`)
            expect(labels).toContain(`introduce:${DOC2_PATH}`)
        })

        it('should still verify inception', async function () {
            const result = await oi.verify({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 10. Key rotation + document introduction combined
    // ──────────────────────────────────────────────────────────────

    describe('10. Key rotation then document introduction', function () {

        const keysDir = join(WORK_DIR, 'rotdoc-keys')
        const repoDir = join(WORK_DIR, 'repo-rotdoc')
        let author: any

        const DOC_PATH = '.o/post-rotation.yaml'
        const DOC_GEN = '.git/o/post-rotation-generator.yaml'

        it('should set up repo, rotate key, then introduce document', async function () {
            author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'RotDoc',
                authorEmail: 'rotdoc@example.com',
                provenancePassphrase: 'rotdoc-test',
                provenanceDate: new Date(Date.UTC(2025, 0, 1)),
            })
            await oi.createRepository({
                repoDir,
                author,
                date: new Date(Date.UTC(2025, 0, 1, 1)),
            })

            // Rotate
            const rotResult = await oi.rotateKey({
                repoDir,
                author,
                keyName: 'rotated_key',
                date: new Date(Date.UTC(2025, 0, 2)),
            })
            author = rotResult.author

            // Introduce document after rotation
            const doc = await oi.createDocument({
                provenancePassphrase: 'post-rot-doc',
                provenanceDate: new Date(Date.UTC(2025, 0, 3)),
            })
            await oi.introduceDocument({
                repoDir,
                author,
                document: doc,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN,
                date: new Date(Date.UTC(2025, 0, 3)),
            })
        })

        it('should verify inception after rotation + document', async function () {
            const result = await oi.verify({ repoDir })
            expect(result.valid).toBe(true)
            expect(result.issues).toEqual([])
        })

        it('should verify the document introduced after rotation', async function () {
            const result = await oi.verifyDocument({
                repoDir,
                documentPath: DOC_PATH,
            })
            expect(result.valid).toBe(true)
            expect(result.documentPathValid).toBe(true)
            expect(result.documentsMapValid).toBe(true)
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 11. provenancePath and getMarkIdentifier
    // ──────────────────────────────────────────────────────────────

    describe('11. Utility methods', function () {

        it('should return the provenance file path', async function () {
            const path = await oi.provenancePath()
            expect(path).toBe('.o/GordianOpenIntegrity.yaml')
        })

        it('should return a mark identifier string', async function () {
            const keysDir = join(WORK_DIR, 'util-keys')
            const repoDir = join(WORK_DIR, 'repo-util')
            const author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'Util',
                authorEmail: 'util@example.com',
            })
            const result = await oi.createRepository({
                repoDir,
                author,
            })

            const markId = await oi.getMarkIdentifier({ mark: result.mark })
            expect(typeof markId).toBe('string')
            expect(markId.length).toBeGreaterThan(0)
        })

        it('should return the latest mark from author ledger', async function () {
            const keysDir = join(WORK_DIR, 'latest-keys')
            const repoDir = join(WORK_DIR, 'repo-latest')
            const author = await oi.createIdentity({
                keyDir: keysDir,
                authorName: 'Latest',
                authorEmail: 'latest@example.com',
            })
            await oi.createRepository({ repoDir, author })

            const mark = await oi.getLatestMark({ author })
            expect(mark).toBeDefined()
        })
    })

})
