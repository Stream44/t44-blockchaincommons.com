#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

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
                    value: './GordianOpenIntegrity'
                },
                key: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './key'
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
        capsuleName: '@stream44.studio/t44-blockchaincommons.com/caps/GordianOpenIntegrity.new.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

describe('GordianOpenIntegrity', function () {

    // ──────────────────────────────────────────────────────────────
    // 1. createDocument
    // ──────────────────────────────────────────────────────────────

    describe('1. createDocument', function () {

        const keysDir = `${workbenchDir}/doc-keys`

        it('should create a standalone XID document from key paths', async function () {
            const docKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_prov' })

            const doc = await oi.createDocument({
                documentKeyPath: docKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            expect(doc).toBeDefined()
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 2. createRepository
    // ──────────────────────────────────────────────────────────────

    describe('2. createRepository', function () {

        const keysDir = `${workbenchDir}/repo-keys`
        const repoDir = `${workbenchDir}/repo-create`
        let author: any
        let publishedMark: string

        it('should create a repository with inception commit and provenance', async function () {
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'first_trust' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'prov' })

            const result = await oi.createRepository({
                repoDir,
                authorName: 'TestAuthor',
                authorEmail: 'test@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            author = result.author

            expect(result.commitHash).toBeDefined()
            expect(result.commitHash.length).toBe(40)
            expect(result.did).toStartWith('did:repo:')
            expect(result.mark).toBeDefined()
            expect(result.author).toBeDefined()
            expect(author.sshKey).toBeDefined()
            expect(author.document).toBeDefined()
            expect(author.ledger).toBeDefined()

            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
            expect(publishedMark).toBeDefined()
        })

        it('should write GordianOpenIntegrity.yaml as valid YAML with schema', async function () {
            const yaml = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity.yaml'] }) })
            const yamlBlock = yaml.split('\n---')[0]
            expect(yamlBlock).toContain('$schema: "https://json-schema.org/draft/2020-12/schema"')
            expect(yamlBlock).toContain('envelope: "ur:envelope/')
            expect(yamlBlock).toContain('mark: "')
            expect(yamlBlock).toContain('$defs:')
        })

        it('should include signing key assertion in GordianOpenIntegrity.yaml', async function () {
            const yaml = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity.yaml'] }) })
            expect(yaml).toContain('"GordianOpenIntegrity.SigningKey"')
            expect(yaml).toContain('ssh-ed25519')
        })

        it('should include repository identifier assertion in GordianOpenIntegrity.yaml', async function () {
            const yaml = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity.yaml'] }) })
            expect(yaml).toContain('"GordianOpenIntegrity.RepositoryIdentifier"')
            expect(yaml).toContain('did:repo:')
        })

        it('should include human-readable envelope after ---', async function () {
            const yaml = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity.yaml'] }) })
            expect(yaml).toContain('---')
            const humanReadable = yaml.split('---')[1]
            expect(humanReadable).toContain('XID')
        })

        it('should store generator state in .git (never committed)', async function () {
            const genPath = await fs.join({ parts: [repoDir, '.git/o/GordianOpenIntegrity-generator.yaml'] })
            const gen = await fs.readFile({ path: genPath })
            expect(gen).toContain('chainID')
        })

        it('should write inception lifehash SVG', async function () {
            const svg = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity-InceptionLifehash.svg'] }) })
            expect(svg).toContain('<svg')
        })

        it('should write current lifehash SVG (same as inception initially)', async function () {
            const svg = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity-CurrentLifehash.svg'] }) })
            expect(svg).toContain('<svg')
        })

        it('should create a ledger with correct labels', async function () {
            const labels = await oi.ledger.getLabels({ ledger: author.ledger })
            expect(labels).toContain('genesis')
            expect(labels).toContain('link-ssh-key')
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 3. verify
    // ──────────────────────────────────────────────────────────────

    describe('3. verify', function () {

        const keysDir = `${workbenchDir}/verify-keys`
        const repoDir = `${workbenchDir}/repo-verify`
        let author: any
        let publishedMark: string

        it('should set up a repo for verification', async function () {
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'verify_first_trust' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'verify_prov' })

            const result = await oi.createRepository({
                repoDir,
                authorName: 'Verifier',
                authorEmail: 'verifier@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            author = result.author
            publishedMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should verify a valid repository with correct mark', async function () {
            const result = await oi.verify({ repoDir, mark: publishedMark })

            expect(result.valid).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
        })

        it('should verify without a mark (still validates against latest)', async function () {
            const result = await oi.verify({ repoDir })

            expect(result.valid).toBe(true)
        })

        it('should fail verification with wrong mark', async function () {
            const result = await oi.verify({ repoDir, mark: 'wrong-mark' })

            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 4. rotateKey
    // ──────────────────────────────────────────────────────────────

    describe('4. rotateTrustSigningKey', function () {

        const keysDir = `${workbenchDir}/rotate-keys`
        const repoDir = `${workbenchDir}/repo-rotate`
        let author: any
        let oldMark: string
        let existingKeyPath: string

        it('should set up a repo for key rotation', async function () {
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'rotate_first_trust' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'rotate_prov' })

            const result = await oi.createRepository({
                repoDir,
                authorName: 'Rotator',
                authorEmail: 'rotator@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            author = result.author
            existingKeyPath = firstTrustKey.privateKeyPath
            oldMark = await oi.getMarkIdentifier({ mark: result.mark })
        })

        it('should rotate to a new signing key', async function () {
            const oldFingerprint = author.sshKey.fingerprint
            const newKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'rotate_new_key' })

            const result = await oi.rotateTrustSigningKey({
                repoDir,
                authorName: 'Rotator',
                authorEmail: 'rotator@example.com',
                existingSigningKeyPath: existingKeyPath,
                newSigningKeyPath: newKey.privateKeyPath,
                author,
            })

            expect(result.newFingerprint).toBeDefined()
            expect(result.newFingerprint).not.toBe(oldFingerprint)
            expect(result.mark).toBeDefined()

            author = result.author
        })

        it('should update current lifehash SVG after rotation', async function () {
            const svg = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity-CurrentLifehash.svg'] }) })
            expect(svg).toContain('<svg')
        })

        it('should only show the rotated signing key in GordianOpenIntegrity.yaml', async function () {
            const yaml = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity.yaml'] }) })
            const matches = yaml.match(/ssh-ed25519/g) || []
            expect(matches.length).toBe(1)
        })

        it('should verify after key rotation with new mark', async function () {
            const newMark = await oi.getMarkIdentifier({ mark: (await oi.ledger.getLatest({ ledger: author.ledger })).mark })
            const result = await oi.verify({ repoDir, mark: newMark })

            expect(result.valid).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
        })

        it('should fail verification with the old mark after rotation', async function () {
            const result = await oi.verify({ repoDir, mark: oldMark })

            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 5. introduceDocument
    // ──────────────────────────────────────────────────────────────

    describe('5. introduceDocument', function () {

        const keysDir = `${workbenchDir}/doc-intro-keys`
        const repoDir = `${workbenchDir}/repo-doc-intro`
        let author: any
        let documentLedger: any
        let trustKeyPath: string
        let repoProvKeyPath: string

        const DOC_PATH = '.o/decisions/policy-v1.yaml'
        const DOC_GEN_PATH = '.git/o/decisions/policy-v1-generator.yaml'

        it('should set up a repo for document introduction', async function () {
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_first_trust' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'doc_prov' })

            const result = await oi.createRepository({
                repoDir,
                authorName: 'DocAuthor',
                authorEmail: 'doc@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            author = result.author
            trustKeyPath = firstTrustKey.privateKeyPath
            repoProvKeyPath = provKey.privateKeyPath
        })

        it('should introduce a document linked to inception', async function () {
            const policyDocKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'policy_doc' })
            const policyProvKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'policy_prov' })

            const doc = await oi.createDocument({
                documentKeyPath: policyDocKey.privateKeyPath,
                provenanceKeyPath: policyProvKey.privateKeyPath,
            })

            const result = await oi.introduceDocument({
                repoDir,
                authorName: 'DocAuthor',
                authorEmail: 'doc@example.com',
                trustKeyPath,
                provenanceKeyPath: policyProvKey.privateKeyPath,
                document: doc,
                documentPath: DOC_PATH,
                generatorPath: DOC_GEN_PATH,
                label: 'initial-policy',
                author,
            })

            documentLedger = result.documentLedger
            expect(result.document).toBeDefined()
            expect(result.documentLedger).toBeDefined()
        })

        it('should write the document YAML file', async function () {
            const yaml = await fs.readFile({ path: await fs.join({ parts: [repoDir, DOC_PATH] }) })
            expect(yaml).toContain('envelope:')
        })

        it('should store document generator state in .git', async function () {
            const gen = await fs.readFile({ path: await fs.join({ parts: [repoDir, DOC_GEN_PATH] }) })
            expect(gen).toContain('chainID')
        })

        it('should update inception envelope with Documents map', async function () {
            const yaml = await fs.readFile({ path: await fs.join({ parts: [repoDir, '.o/GordianOpenIntegrity.yaml'] }) })
            expect(yaml).toContain('"GordianOpenIntegrity.Documents"')
            expect(yaml).toContain(DOC_PATH)
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 6. commitToRepository
    // ──────────────────────────────────────────────────────────────

    describe('6. commitToRepository', function () {

        const keysDir = `${workbenchDir}/commit-keys`
        const repoDir = `${workbenchDir}/repo-commit`
        let signingKeyPath: string

        it('should set up a repo for commit tests', async function () {
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'commit_first_trust' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'commit_prov' })

            await oi.createRepository({
                repoDir,
                authorName: 'Committer',
                authorEmail: 'committer@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            signingKeyPath = firstTrustKey.privateKeyPath
        })

        it('should create a signed commit with files', async function () {
            await oi.commitToRepository({
                repoDir,
                authorName: 'Committer',
                authorEmail: 'committer@example.com',
                signingKeyPath,
                message: 'Add README',
                files: [{ path: 'README.md', content: '# Test\n' }],
            })

            const readme = await fs.readFile({ path: await fs.join({ parts: [repoDir, 'README.md'] }) })
            expect(readme).toBe('# Test\n')
        })

        it('should create an empty signed commit', async function () {
            await oi.commitToRepository({
                repoDir,
                authorName: 'Committer',
                authorEmail: 'committer@example.com',
                signingKeyPath,
                message: 'Empty commit',
                allowEmpty: true,
            })
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 7. createTrustRoot (reset trust root on existing repo)
    // ──────────────────────────────────────────────────────────────

    describe('7. createTrustRoot', function () {

        const keysDir = `${workbenchDir}/trust-root-keys`
        const repoDir = `${workbenchDir}/repo-trust-root`
        let originalDid: string
        let originalMark: string
        let newMark: string
        let signingKeyPath: string

        it('should set up a repo with inception and commit a README', async function () {
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'trust_first' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'trust_prov' })

            signingKeyPath = firstTrustKey.privateKeyPath

            const result = await oi.createRepository({
                repoDir,
                authorName: 'TrustAuthor',
                authorEmail: 'trust@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            originalDid = result.did
            originalMark = await oi.getMarkIdentifier({ mark: result.mark })

            await oi.commitToRepository({
                repoDir,
                authorName: 'TrustAuthor',
                authorEmail: 'trust@example.com',
                signingKeyPath: firstTrustKey.privateKeyPath,
                message: 'Add README',
                files: [{ path: 'README.md', content: '# Trust Root Test\n' }],
            })
        })

        it('should create a new trust root preserving the repository identifier', async function () {
            const newProvKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'trust_new_prov' })

            const result = await oi.createTrustRoot({
                repoDir,
                authorName: 'TrustAuthor',
                authorEmail: 'trust@example.com',
                firstTrustKeyPath: signingKeyPath,
                provenanceKeyPath: newProvKey.privateKeyPath,
            })

            expect(result.did).toBe(originalDid)
            expect(result.commitHash).toBeDefined()
            expect(result.mark).toBeDefined()

            newMark = await oi.getMarkIdentifier({ mark: result.mark })
            expect(newMark).not.toBe(originalMark)
        })

        it('should verify the repo with the new trust root', async function () {
            const result = await oi.verify({ repoDir, mark: newMark })

            expect(result.valid).toBe(true)
            expect(result.markMatchesLatest).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.validSignatures).toBe(result.totalCommits)
            expect(result.invalidSignatures).toBe(0)
        })

        it('should fail verification with the old mark', async function () {
            const result = await oi.verify({ repoDir, mark: originalMark })

            expect(result.valid).toBe(false)
            expect(result.markMatchesLatest).toBe(false)
        })

        it('should preserve the README file', async function () {
            const readme = await fs.readFile({ path: await fs.join({ parts: [repoDir, 'README.md'] }) })
            expect(readme).toBe('# Trust Root Test\n')
        })
    })

    // ──────────────────────────────────────────────────────────────
    // 8. Utility methods
    // ──────────────────────────────────────────────────────────────

    describe('8. Utility methods', function () {

        const keysDir = `${workbenchDir}/util-keys`

        it('should return the provenance file path', async function () {
            const path = await oi.provenancePath()
            expect(path).toBe('.o/GordianOpenIntegrity.yaml')
        })

        it('should return a mark identifier string', async function () {
            const repoDir = `${workbenchDir}/repo-util`
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'util_first_trust' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'util_prov' })

            const result = await oi.createRepository({
                repoDir,
                authorName: 'Util',
                authorEmail: 'util@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            const markId = await oi.getMarkIdentifier({ mark: result.mark })
            expect(typeof markId).toBe('string')
            expect(markId.length).toBeGreaterThan(0)
        })

        it('should return the latest mark from author ledger', async function () {
            const repoDir = `${workbenchDir}/repo-latest`
            const firstTrustKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'latest_first_trust' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'latest_prov' })

            const result = await oi.createRepository({
                repoDir,
                authorName: 'Latest',
                authorEmail: 'latest@example.com',
                firstTrustKeyPath: firstTrustKey.privateKeyPath,
                provenanceKeyPath: provKey.privateKeyPath,
            })

            const latest = await oi.ledger.getLatest({ ledger: result.author.ledger })
            expect(latest.mark).toBeDefined()
        })
    })
})
