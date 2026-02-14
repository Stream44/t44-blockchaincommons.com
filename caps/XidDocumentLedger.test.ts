#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/workspace-rt'
import { join } from 'path'
import { rm, mkdir } from 'fs/promises'

const WORK_DIR = join(import.meta.dir, '.~xid-ledger')

const {
    test: { describe, it, expect },
    xid,
    ledger: revisionLedger,
    cli,
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
                xid: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './xid'
                },
                ledger: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './XidDocumentLedger'
                },
                cli: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './provenance-mark-cli'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/XidDocumentLedger.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

const fs = await import('fs')
const path = await import('path')

const {
    PrivateKeyBase,
    Privilege,
    XIDPrivateKeyOptions,
    XIDGeneratorOptions,
} = await xid.types()

// Clean up before tests
await rm(WORK_DIR, { recursive: true, force: true })
await mkdir(WORK_DIR, { recursive: true })

describe('XID Ledger', function () {

    let doc: any
    let ledger: any
    let aliceKeyBase: any
    let bobKeyBase: any
    let carolKeyBase: any

    // ──────────────────────────────────────────────────────────────────
    // 1. Ledger creation
    // ──────────────────────────────────────────────────────────────────

    describe('1. Ledger creation', function () {

        it('should create a ledger from a document with provenance', async function () {
            aliceKeyBase = PrivateKeyBase.new()
            doc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: aliceKeyBase,
                provenance: {
                    type: 'passphrase',
                    passphrase: 'ledger-test',
                    date: new Date(Date.UTC(2025, 0, 1)),
                },
            })

            ledger = await revisionLedger.createLedger({ document: doc })
            expect(ledger).toBeDefined()
        })

        it('should start with exactly one revision (genesis)', async function () {
            const len = await revisionLedger.length({ ledger })
            expect(len).toBe(1)
        })

        it('should capture the XID at creation', async function () {
            const ledgerXid = await revisionLedger.getXid({ ledger })
            const docXid = await xid.getXid({ document: doc })
            expect(ledgerXid.equals(docXid)).toBe(true)
        })

        it('should reject a document without provenance', async function () {
            const plainDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
            })
            await expect(
                revisionLedger.createLedger({ document: plainDoc })
            ).rejects.toThrow('provenance')
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 2. Genesis revision properties
    // ──────────────────────────────────────────────────────────────────

    describe('2. Genesis revision', function () {

        it('should have seq 0', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            expect(genesis.seq).toBe(0)
        })

        it('should have label "genesis"', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            expect(genesis.label).toBe('genesis')
        })

        it('should have a genesis provenance mark', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            expect(genesis.mark.isGenesis()).toBe(true)
        })

        it('should have a date', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            expect(genesis.date).toBeInstanceOf(Date)
        })

        it('should have a cloned document (independent of the live doc)', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            const genesisKeys = await xid.getKeys({ document: genesis.document })
            expect(genesisKeys.length).toBe(1)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 3. Committing revisions
    // ──────────────────────────────────────────────────────────────────

    describe('3. Committing revisions', function () {

        it('should commit a revision after adding a key', async function () {
            bobKeyBase = PrivateKeyBase.new()
            await xid.addKey({
                document: doc,
                publicKeys: bobKeyBase.ed25519PublicKeys(),
                allowAll: true,
            })

            ledger = await revisionLedger.commit({
                ledger,
                document: doc,
                label: 'add-bob',
                date: new Date(Date.UTC(2025, 0, 2)),
            })

            const len = await revisionLedger.length({ ledger })
            expect(len).toBe(2)
        })

        it('should commit a revision after removing inception key', async function () {
            await xid.removeInceptionKey({ document: doc })

            ledger = await revisionLedger.commit({
                ledger,
                document: doc,
                label: 'remove-inception',
                date: new Date(Date.UTC(2025, 0, 3)),
            })

            const len = await revisionLedger.length({ ledger })
            expect(len).toBe(3)
        })

        it('should commit a revision after adding another key', async function () {
            carolKeyBase = PrivateKeyBase.new()
            await xid.addKey({
                document: doc,
                publicKeys: carolKeyBase.ed25519PublicKeys(),
                allowAll: true,
            })

            ledger = await revisionLedger.commit({
                ledger,
                document: doc,
                label: 'add-carol',
                date: new Date(Date.UTC(2025, 0, 4)),
            })

            const len = await revisionLedger.length({ ledger })
            expect(len).toBe(4)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 4. Querying revisions
    // ──────────────────────────────────────────────────────────────────

    describe('4. Querying revisions', function () {

        it('should retrieve a revision by seq', async function () {
            const rev = await revisionLedger.getRevision({ ledger, seq: 1 })
            expect(rev).toBeDefined()
            expect(rev.label).toBe('add-bob')
            expect(rev.seq).toBe(1)
        })

        it('should retrieve a revision by label', async function () {
            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'remove-inception' })
            expect(rev).toBeDefined()
            expect(rev.seq).toBe(2)
        })

        it('should return undefined for a non-existent seq', async function () {
            const rev = await revisionLedger.getRevision({ ledger, seq: 99 })
            expect(rev).toBeUndefined()
        })

        it('should return undefined for a non-existent label', async function () {
            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'does-not-exist' })
            expect(rev).toBeUndefined()
        })

        it('should get the latest revision', async function () {
            const latest = await revisionLedger.getLatest({ ledger })
            expect(latest.seq).toBe(3)
            expect(latest.label).toBe('add-carol')
        })

        it('should get the genesis revision', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            expect(genesis.seq).toBe(0)
            expect(genesis.label).toBe('genesis')
        })

        it('should list all labels in order', async function () {
            const labels = await revisionLedger.getLabels({ ledger })
            expect(labels).toEqual(['genesis', 'add-bob', 'remove-inception', 'add-carol'])
        })

        it('should list all revisions', async function () {
            const revisions = await revisionLedger.getRevisions({ ledger })
            expect(revisions.length).toBe(4)
            expect(revisions.map((r: any) => r.seq)).toEqual([0, 1, 2, 3])
        })

        it('should extract all provenance marks', async function () {
            const marks = await revisionLedger.getMarks({ ledger })
            expect(marks.length).toBe(4)
            expect(marks[0].seq()).toBe(0)
            expect(marks[3].seq()).toBe(3)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 5. Document snapshots are independent
    // ──────────────────────────────────────────────────────────────────

    describe('5. Document snapshot isolation', function () {

        it('should preserve genesis document state (1 key)', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            const keys = await xid.getKeys({ document: genesis.document })
            expect(keys.length).toBe(1)

            const inceptionKey = await xid.getInceptionKey({ document: genesis.document })
            expect(inceptionKey).toBeDefined()
        })

        it('should preserve add-bob document state (2 keys)', async function () {
            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'add-bob' })
            const keys = await xid.getKeys({ document: rev.document })
            expect(keys.length).toBe(2)

            const inceptionKey = await xid.getInceptionKey({ document: rev.document })
            expect(inceptionKey).toBeDefined()
        })

        it('should preserve remove-inception document state (1 key, no inception)', async function () {
            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'remove-inception' })
            const keys = await xid.getKeys({ document: rev.document })
            expect(keys.length).toBe(1)

            const inceptionKey = await xid.getInceptionKey({ document: rev.document })
            expect(inceptionKey).toBeUndefined()
        })

        it('should preserve add-carol document state (2 keys, no inception)', async function () {
            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'add-carol' })
            const keys = await xid.getKeys({ document: rev.document })
            expect(keys.length).toBe(2)

            const inceptionKey = await xid.getInceptionKey({ document: rev.document })
            expect(inceptionKey).toBeUndefined()
        })

        it('should have the same XID in every revision snapshot', async function () {
            const ledgerXid = await revisionLedger.getXid({ ledger })
            const revisions = await revisionLedger.getRevisions({ ledger })
            for (const rev of revisions) {
                const revXid = await xid.getXid({ document: rev.document })
                expect(ledgerXid.equals(revXid)).toBe(true)
            }
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 6. Full verification
    // ──────────────────────────────────────────────────────────────────

    describe('6. Full verification', function () {

        it('should verify a valid ledger', async function () {
            const result = await revisionLedger.verify({ ledger })
            expect(result.valid).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.genesisPresent).toBe(true)
            expect(result.chainIntact).toBe(true)
            expect(result.sequenceValid).toBe(true)
            expect(result.datesMonotonic).toBe(true)
            expect(result.issues.length).toBe(0)
        })

        it('should include a validation report with no issues', async function () {
            const result = await revisionLedger.verify({ ledger })
            expect(result.report).toBeDefined()
            expect(result.report.chains.length).toBe(1)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 7. XID stability enforcement
    // ──────────────────────────────────────────────────────────────────

    describe('7. XID stability enforcement', function () {

        it('should reject a commit with a different XID document', async function () {
            const otherDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
                provenance: {
                    type: 'passphrase',
                    passphrase: 'other-doc',
                    date: new Date(Date.UTC(2025, 0, 1)),
                },
            })

            await expect(
                revisionLedger.commit({
                    ledger,
                    document: otherDoc,
                    label: 'wrong-xid',
                    date: new Date(Date.UTC(2025, 0, 5)),
                })
            ).rejects.toThrow('XID mismatch')
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 8. Formatting
    // ──────────────────────────────────────────────────────────────────

    describe('8. Formatting', function () {

        it('should format a revision as envelope text', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            const text = await revisionLedger.formatRevision({ revision: genesis })
            expect(typeof text).toBe('string')
            expect(text.length).toBeGreaterThan(0)
        })

        it('should format a revision with private keys included', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            const text = await revisionLedger.formatRevision({
                revision: genesis,
                privateKeyOptions: XIDPrivateKeyOptions.Include,
                generatorOptions: XIDGeneratorOptions.Include,
            })
            expect(text).toContain('privateKey')
        })

        it('should format a ledger summary', async function () {
            const summary = await revisionLedger.formatSummary({ ledger })
            expect(summary).toContain('XID Ledger')
            expect(summary).toContain('4 revisions')
            expect(summary).toContain('"genesis"')
            expect(summary).toContain('"add-bob"')
            expect(summary).toContain('"remove-inception"')
            expect(summary).toContain('"add-carol"')
            expect(summary).toContain('#0')
            expect(summary).toContain('#3')
        })

        it('should match the summary snapshot', async function () {
            const summary = await revisionLedger.formatSummary({ ledger })
            expect(summary).toMatchSnapshot()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 9. Single-revision ledger edge case
    // ──────────────────────────────────────────────────────────────────

    describe('9. Single-revision ledger', function () {

        let singleLedger: any

        it('should create a valid single-revision ledger', async function () {
            const singleDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
                provenance: {
                    type: 'passphrase',
                    passphrase: 'single-rev',
                    date: new Date(Date.UTC(2025, 5, 1)),
                },
            })
            singleLedger = await revisionLedger.createLedger({ document: singleDoc })
            const len = await revisionLedger.length({ ledger: singleLedger })
            expect(len).toBe(1)
        })

        it('should verify a single-revision ledger', async function () {
            const result = await revisionLedger.verify({ ledger: singleLedger })
            expect(result.valid).toBe(true)
            expect(result.genesisPresent).toBe(true)
            expect(result.chainIntact).toBe(true)
            expect(result.sequenceValid).toBe(true)
        })

        it('should have latest === genesis', async function () {
            const latest = await revisionLedger.getLatest({ ledger: singleLedger })
            const genesis = await revisionLedger.getGenesis({ ledger: singleLedger })
            expect(latest.seq).toBe(genesis.seq)
            expect(latest.label).toBe(genesis.label)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 10. File storage (storeDir)
    // ──────────────────────────────────────────────────────────────────

    describe('10. File storage', function () {

        let storedLedger: any
        let storedDoc: any
        const storeDir = path.join(WORK_DIR, 'stored-ledger')

        it('should create a ledger with storeDir and write genesis files', async function () {
            storedDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
                provenance: {
                    type: 'passphrase',
                    passphrase: 'stored-ledger-test',
                    date: new Date(Date.UTC(2025, 0, 1)),
                },
            })

            storedLedger = await revisionLedger.createLedger({
                document: storedDoc,
                storeDir,
            })

            expect(fs.existsSync(storeDir)).toBe(true)
            expect(fs.existsSync(path.join(storeDir, 'generator.json'))).toBe(true)
            expect(fs.existsSync(path.join(storeDir, 'marks'))).toBe(true)
            expect(fs.existsSync(path.join(storeDir, 'marks', 'mark-0.json'))).toBe(true)
        })

        it('should write valid generator.json', async function () {
            const generatorJson = JSON.parse(fs.readFileSync(path.join(storeDir, 'generator.json'), 'utf-8'))
            expect(generatorJson).toBeDefined()
        })

        it('should write valid mark-0.json with comment', async function () {
            const markJson = JSON.parse(fs.readFileSync(path.join(storeDir, 'marks', 'mark-0.json'), 'utf-8'))
            expect(markJson).toBeDefined()
            expect(markJson.comment).toBe('genesis')
        })

        it('should write mark files on commit', async function () {
            await xid.addKey({
                document: storedDoc,
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
                allowAll: true,
            })

            storedLedger = await revisionLedger.commit({
                ledger: storedLedger,
                document: storedDoc,
                label: 'add-key',
                date: new Date(Date.UTC(2025, 0, 2)),
            })

            expect(fs.existsSync(path.join(storeDir, 'marks', 'mark-1.json'))).toBe(true)

            const markJson = JSON.parse(fs.readFileSync(path.join(storeDir, 'marks', 'mark-1.json'), 'utf-8'))
            expect(markJson.comment).toBe('add-key')
        })

        it('should update generator.json on commit', async function () {
            const generatorJson = JSON.parse(fs.readFileSync(path.join(storeDir, 'generator.json'), 'utf-8'))
            expect(generatorJson).toBeDefined()
        })

        it('should write another mark on second commit', async function () {
            await xid.addKey({
                document: storedDoc,
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
                allowAll: true,
            })

            storedLedger = await revisionLedger.commit({
                ledger: storedLedger,
                document: storedDoc,
                label: 'add-another-key',
                date: new Date(Date.UTC(2025, 0, 3)),
            })

            expect(fs.existsSync(path.join(storeDir, 'marks', 'mark-2.json'))).toBe(true)
        })

        it('should verify the stored ledger', async function () {
            const result = await revisionLedger.verify({ ledger: storedLedger })
            expect(result.valid).toBe(true)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 11. Cross-compatibility: xid-ledger <-> provenance-mark-cli
    // ──────────────────────────────────────────────────────────────────

    describe('11. Cross-compatibility with provenance-mark-cli', function () {

        let crossDoc: any
        let crossLedger: any
        const crossDir = path.join(WORK_DIR, 'cross-compat')

        it('should create a ledger with storeDir (xid-ledger writes genesis)', async function () {
            crossDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
                provenance: {
                    type: 'passphrase',
                    passphrase: 'cross-compat-test',
                    date: new Date(Date.UTC(2025, 0, 1)),
                },
            })

            crossLedger = await revisionLedger.createLedger({
                document: crossDoc,
                storeDir: crossDir,
            })

            expect(await revisionLedger.length({ ledger: crossLedger })).toBe(1)
        })

        it('should validate genesis with provenance-mark-cli', async function () {
            const output = await cli.validate({
                dir: crossDir,
                format: 'json-pretty',
            })

            const parsed = JSON.parse(output)
            expect(parsed).toBeDefined()
        })

        it('should commit a second revision (xid-ledger writes mark-1)', async function () {
            await xid.addKey({
                document: crossDoc,
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
                allowAll: true,
            })

            crossLedger = await revisionLedger.commit({
                ledger: crossLedger,
                document: crossDoc,
                label: 'second-revision',
                date: new Date(Date.UTC(2025, 0, 2)),
            })

            expect(await revisionLedger.length({ ledger: crossLedger })).toBe(2)
        })

        it('should validate 2 marks with provenance-mark-cli', async function () {
            const output = await cli.validate({
                dir: crossDir,
                format: 'json-pretty',
            })

            const parsed = JSON.parse(output)
            expect(parsed).toBeDefined()
        })

        it('should verify with xid-ledger after 2 commits', async function () {
            const result = await revisionLedger.verify({ ledger: crossLedger })
            expect(result.valid).toBe(true)
            expect(result.chainIntact).toBe(true)
            expect(result.sequenceValid).toBe(true)
        })

        it('should commit a third revision (xid-ledger writes mark-2)', async function () {
            await xid.addKey({
                document: crossDoc,
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
                allowAll: true,
            })

            crossLedger = await revisionLedger.commit({
                ledger: crossLedger,
                document: crossDoc,
                label: 'third-revision',
                date: new Date(Date.UTC(2025, 0, 3)),
            })

            expect(await revisionLedger.length({ ledger: crossLedger })).toBe(3)
        })

        it('should validate 3 marks with provenance-mark-cli', async function () {
            const output = await cli.validate({
                dir: crossDir,
                format: 'json-pretty',
            })

            const parsed = JSON.parse(output)
            expect(parsed).toBeDefined()
        })

        it('should print all marks with provenance-mark-cli in JSON format', async function () {
            const output = await cli.print({
                path: crossDir,
                format: 'json',
            })

            const parsed = JSON.parse(output)
            expect(Array.isArray(parsed)).toBe(true)
            expect(parsed.length).toBe(3)
            expect(parsed[0].comment).toBe('genesis')
            expect(parsed[1].comment).toBe('second-revision')
            expect(parsed[2].comment).toBe('third-revision')
        })

        it('should verify the full ledger with xid-ledger', async function () {
            const result = await revisionLedger.verify({ ledger: crossLedger })
            expect(result.valid).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.genesisPresent).toBe(true)
            expect(result.chainIntact).toBe(true)
            expect(result.sequenceValid).toBe(true)
            expect(result.datesMonotonic).toBe(true)
            expect(result.issues).toEqual([])
        })

        it('should have matching mark count between ledger and stored files', async function () {
            const ledgerLen = await revisionLedger.length({ ledger: crossLedger })

            const printOutput = await cli.print({
                path: crossDir,
                format: 'json',
            })
            const storedMarks = JSON.parse(printOutput)

            expect(ledgerLen).toBe(storedMarks.length)
        })
    })

})
