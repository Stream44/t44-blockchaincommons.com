#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect },
    xid,
    ledger: revisionLedger,
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
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/xid'
                },
                ledger: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/XidDocumentLedger'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/t44-blockchaincommons.com/examples/01-XID-DocumentLedger'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

const { PrivateKeyBase } = await xid.types()

describe('XID Ledger', function () {

    let doc: any
    let ledger: any

    // ──────────────────────────────────────────────────────────────────
    // 1. Create a document and open a ledger
    // ──────────────────────────────────────────────────────────────────

    describe('1. Open ledger', function () {

        it('should create a document with provenance and open a ledger', async function () {
            doc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
                provenance: {
                    type: 'passphrase',
                    passphrase: 'ledger-example',
                    date: new Date(Date.UTC(2025, 0, 1)),
                },
            })

            ledger = await revisionLedger.createLedger({ document: doc })

            const len = await revisionLedger.length({ ledger })
            expect(len).toBe(1)

            const genesis = await revisionLedger.getGenesis({ ledger })
            expect(genesis.label).toBe('genesis')
            expect(genesis.seq).toBe(0)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 2. Make changes and commit revisions
    // ──────────────────────────────────────────────────────────────────

    describe('2. Commit revisions', function () {

        it('should commit after adding a second key', async function () {
            await xid.addKey({
                document: doc,
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
                allowAll: true,
            })

            ledger = await revisionLedger.commit({
                ledger,
                document: doc,
                label: 'add-second-key',
                date: new Date(Date.UTC(2025, 0, 2)),
            })

            expect(await revisionLedger.length({ ledger })).toBe(2)
        })

        it('should commit after adding a third key', async function () {
            await xid.addKey({
                document: doc,
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
                allowAll: true,
            })

            ledger = await revisionLedger.commit({
                ledger,
                document: doc,
                label: 'add-third-key',
                date: new Date(Date.UTC(2025, 0, 3)),
            })

            expect(await revisionLedger.length({ ledger })).toBe(3)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 3. Query the ledger
    // ──────────────────────────────────────────────────────────────────

    describe('3. Query', function () {

        it('should list all revision labels', async function () {
            const labels = await revisionLedger.getLabels({ ledger })
            expect(labels).toEqual(['genesis', 'add-second-key', 'add-third-key'])
        })

        it('should look up a revision by label', async function () {
            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'add-second-key' })
            expect(rev.seq).toBe(1)

            const keys = await xid.getKeys({ document: rev.document })
            expect(keys.length).toBe(2)
        })

        it('should get the latest revision', async function () {
            const latest = await revisionLedger.getLatest({ ledger })
            expect(latest.label).toBe('add-third-key')

            const keys = await xid.getKeys({ document: latest.document })
            expect(keys.length).toBe(3)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 4. Verify the ledger
    // ──────────────────────────────────────────────────────────────────

    describe('4. Verify', function () {

        it('should pass full verification', async function () {
            const result = await revisionLedger.verify({ ledger })

            expect(result.valid).toBe(true)
            expect(result.xidStable).toBe(true)
            expect(result.genesisPresent).toBe(true)
            expect(result.chainIntact).toBe(true)
            expect(result.sequenceValid).toBe(true)
            expect(result.datesMonotonic).toBe(true)
            expect(result.issues).toEqual([])
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 5. Summary
    // ──────────────────────────────────────────────────────────────────

    describe('5. Summary', function () {

        it('should have correct ledger summary', async function () {
            const summary = await revisionLedger.formatSummary({ ledger })
            const lines = summary.split('\n')
            expect(lines[0]).toContain('3 revisions')
            expect(lines[1]).toMatch(/^XID: XID\([0-9a-f]{8}\)$/)
            expect(lines[3]).toMatch(/#0 .+ "genesis"/)
            expect(lines[4]).toMatch(/#1 .+ "add-second-key"/)
            expect(lines[5]).toMatch(/#2 .+ "add-third-key"/)
        })
    })

})
