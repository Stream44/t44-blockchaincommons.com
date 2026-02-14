#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/workspace-rt'

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
        capsuleName: '@stream44.studio/t44-blockchaincommons.com/examples/02-XID-Rotate-InceptionKey'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

const {
    PrivateKeyBase,
    XIDPrivateKeyOptions,
    XIDGeneratorOptions,
    Privilege,
} = await xid.types()

describe('XID Rotate Inception Key', function () {

    let doc: any
    let ledger: any
    let aliceKeyBase: any
    let bobKeyBase: any

    // ──────────────────────────────────────────────────────────────────
    // 1. Create XID document with Alice as inception key
    // ──────────────────────────────────────────────────────────────────

    describe('1. Inception', function () {

        it('should create an XID document with Alice as inception key and open a ledger', async function () {
            aliceKeyBase = PrivateKeyBase.new()
            doc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: aliceKeyBase,
                provenance: {
                    type: 'passphrase',
                    passphrase: 'xid-rotate-example',
                    date: new Date(Date.UTC(2025, 0, 1)),
                },
            })

            ledger = await revisionLedger.createLedger({ document: doc })

            const genesis = await revisionLedger.getGenesis({ ledger })
            expect(genesis.seq).toBe(0)

            const inceptionKey = await xid.getInceptionKey({ document: genesis.document })
            expect(inceptionKey).toBeDefined()
            expect(inceptionKey.permissions().isAllowed(Privilege.All)).toBe(true)

            const keys = await xid.getKeys({ document: genesis.document })
            expect(keys.length).toBe(1)
        })

        it('should match the inception document snapshot', async function () {
            const genesis = await revisionLedger.getGenesis({ ledger })
            const text = await revisionLedger.formatRevision({
                revision: genesis,
                privateKeyOptions: XIDPrivateKeyOptions.Include,
                generatorOptions: XIDGeneratorOptions.Include,
            })
            expect(text).toMatchSnapshot()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 2. Add Bob as a second key
    // ──────────────────────────────────────────────────────────────────

    describe('2. Add Bob key', function () {

        it('should add Bob as a second key with all permissions', async function () {
            bobKeyBase = PrivateKeyBase.new()
            await xid.addKey({
                document: doc,
                publicKeys: bobKeyBase.ed25519PublicKeys(),
                allowAll: true,
            })

            ledger = await revisionLedger.commit({
                ledger,
                document: doc,
                label: 'add-bob-key',
                date: new Date(Date.UTC(2025, 0, 2)),
            })

            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'add-bob-key' })
            expect(rev.seq).toBe(1)

            const keys = await xid.getKeys({ document: rev.document })
            expect(keys.length).toBe(2)
        })

        it('should match the two-key document snapshot', async function () {
            const rev = await revisionLedger.getRevisionByLabel({ ledger, label: 'add-bob-key' })
            const text = await revisionLedger.formatRevision({
                revision: rev,
                privateKeyOptions: XIDPrivateKeyOptions.Include,
                generatorOptions: XIDGeneratorOptions.Include,
            })
            expect(text).toMatchSnapshot()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 3. Remove inception key (Alice)
    // ──────────────────────────────────────────────────────────────────

    describe('3. Remove inception key', function () {

        it('should remove the inception key', async function () {
            const removeResult = await xid.removeInceptionKey({ document: doc })
            expect(removeResult.removedKey).toBeDefined()

            ledger = await revisionLedger.commit({
                ledger,
                document: doc,
                label: 'remove-inception-key',
                date: new Date(Date.UTC(2025, 0, 3)),
            })

            const rev = await revisionLedger.getLatest({ ledger })
            expect(rev.seq).toBe(2)

            // Inception key should be gone
            const inceptionKey = await xid.getInceptionKey({ document: rev.document })
            expect(inceptionKey).toBeUndefined()

            // Only Bob's key remains
            const keys = await xid.getKeys({ document: rev.document })
            expect(keys.length).toBe(1)
        })

        it('should match the post-rotation document snapshot', async function () {
            const rev = await revisionLedger.getLatest({ ledger })
            const text = await revisionLedger.formatRevision({
                revision: rev,
                privateKeyOptions: XIDPrivateKeyOptions.Include,
                generatorOptions: XIDGeneratorOptions.Include,
            })
            expect(text).toMatchSnapshot()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 4. Verify the ledger
    // ──────────────────────────────────────────────────────────────────

    describe('4. Ledger verification', function () {

        it('should have 3 revisions', async function () {
            const labels = await revisionLedger.getLabels({ ledger })
            expect(labels).toEqual(['genesis', 'add-bob-key', 'remove-inception-key'])
        })

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

        it('should round-trip the latest revision with XID and provenance intact', async function () {
            const envelope = await xid.toEnvelope({
                document: doc,
                generatorOptions: XIDGeneratorOptions.Include,
            })
            const restored = await xid.fromEnvelope({ envelope })

            const ledgerXid = await revisionLedger.getXid({ ledger })
            const restoredXid = await xid.getXid({ document: restored })
            expect(ledgerXid.equals(restoredXid)).toBe(true)

            const inceptionKey = await xid.getInceptionKey({ document: restored })
            expect(inceptionKey).toBeUndefined()

            const keys = await xid.getKeys({ document: restored })
            expect(keys.length).toBe(1)

            const provenance = await xid.getProvenance({ document: restored })
            expect(provenance.mark).toBeDefined()
            expect(provenance.mark.seq()).toBe(2)
        })

        it('should match the ledger summary snapshot', async function () {
            const summary = await revisionLedger.formatSummary({ ledger })
            expect(summary).toMatchSnapshot()
        })
    })

})
