#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect },
    provenanceMark
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
                provenanceMark: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './provenance-mark'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/provenance-mark.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

const {
    ProvenanceMarkResolution,
} = await provenanceMark.types()

describe('Provenance Mark Capsule', function () {

    let generator: any
    const marks: any[] = []

    // ──────────────────────────────────────────────────────────────────
    // 1. Generator creation
    // ──────────────────────────────────────────────────────────────────

    describe('1. Generator creation', function () {

        it('should create a generator from a passphrase', async function () {
            generator = await provenanceMark.createGenerator({
                type: 'passphrase',
                passphrase: 'test-provenance-cap',
                resolution: ProvenanceMarkResolution.Medium,
            })
            expect(generator).toBeDefined()
        })

        it('should create a generator with random seed', async function () {
            const gen = await provenanceMark.createGenerator({
                type: 'random',
            })
            expect(gen).toBeDefined()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 2. Mark generation
    // ──────────────────────────────────────────────────────────────────

    describe('2. Mark generation', function () {

        it('should generate a genesis mark (seq 0)', async function () {
            const mark = await provenanceMark.nextMark({
                generator,
                date: new Date(Date.UTC(2025, 0, 1)),
            })
            marks.push(mark)

            expect(await provenanceMark.getSeq({ mark })).toBe(0)
            expect(await provenanceMark.isGenesis({ mark })).toBe(true)
        })

        it('should generate subsequent marks with increasing sequence', async function () {
            for (let i = 1; i <= 4; i++) {
                const mark = await provenanceMark.nextMark({
                    generator,
                    date: new Date(Date.UTC(2025, 0, 1 + i)),
                })
                marks.push(mark)

                expect(await provenanceMark.getSeq({ mark })).toBe(i)
                expect(await provenanceMark.isGenesis({ mark })).toBe(false)
            }
            expect(marks.length).toBe(5)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 3. Mark properties
    // ──────────────────────────────────────────────────────────────────

    describe('3. Mark properties', function () {

        it('should expose chain ID', async function () {
            const chainId = await provenanceMark.getChainId({ mark: marks[0] })
            expect(chainId).toBeInstanceOf(Uint8Array)
            expect(chainId.length).toBeGreaterThan(0)
        })

        it('should expose hash', async function () {
            const hash = await provenanceMark.getHash({ mark: marks[0] })
            expect(hash).toBeInstanceOf(Uint8Array)
            expect(hash.length).toBeGreaterThan(0)
        })

        it('should expose identifier', async function () {
            const id = await provenanceMark.getIdentifier({ mark: marks[0] })
            expect(typeof id).toBe('string')
            expect(id.length).toBeGreaterThan(0)
        })

        it('should expose date', async function () {
            const date = await provenanceMark.getDate({ mark: marks[0] })
            expect(date).toBeInstanceOf(Date)
        })

        it('should produce a debug string', async function () {
            const debug = await provenanceMark.toDebugString({ mark: marks[0] })
            expect(debug).toContain('ProvenanceMark(')
            expect(debug).toContain('seq: 0')
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 4. Chain verification
    // ──────────────────────────────────────────────────────────────────

    describe('4. Chain verification', function () {

        it('should verify each mark precedes the next', async function () {
            for (let i = 0; i < marks.length - 1; i++) {
                const result = await provenanceMark.precedes({
                    mark: marks[i],
                    next: marks[i + 1],
                })
                expect(result).toBe(true)
            }
        })

        it('should validate the full sequence', async function () {
            const valid = await provenanceMark.isSequenceValid({ marks })
            expect(valid).toBe(true)
        })

        it('should detect that non-adjacent marks do not precede each other', async function () {
            // mark[0] should NOT directly precede mark[2] (skips mark[1])
            const result = await provenanceMark.precedes({
                mark: marks[0],
                next: marks[2],
            })
            expect(result).toBe(false)
        })

        it('should share the same chain ID across all marks', async function () {
            const genesisChainId = await provenanceMark.getChainId({ mark: marks[0] })
            for (let i = 1; i < marks.length; i++) {
                const chainId = await provenanceMark.getChainId({ mark: marks[i] })
                expect(Buffer.from(chainId).equals(Buffer.from(genesisChainId))).toBe(true)
            }
        })

        it('should have monotonically non-decreasing dates', async function () {
            for (let i = 1; i < marks.length; i++) {
                const prevDate = await provenanceMark.getDate({ mark: marks[i - 1] })
                const currDate = await provenanceMark.getDate({ mark: marks[i] })
                expect(currDate >= prevDate).toBe(true)
            }
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 5. Validation report
    // ──────────────────────────────────────────────────────────────────

    describe('5. Validation report', function () {

        it('should produce a clean validation report for a valid chain', async function () {
            const report = await provenanceMark.validate({ marks })
            const issues = await provenanceMark.hasIssues({ report })
            expect(issues).toBe(false)
        })

        it('should detect issues in a broken sequence', async function () {
            // Skip mark[1] to create a gap
            const brokenMarks = [marks[0], marks[2], marks[4]]
            const report = await provenanceMark.validate({ marks: brokenMarks })
            const issues = await provenanceMark.hasIssues({ report })
            expect(issues).toBe(true)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 6. Mark equality
    // ──────────────────────────────────────────────────────────────────

    describe('6. Mark equality', function () {

        it('should consider the same mark equal to itself', async function () {
            const result = await provenanceMark.markEquals({
                mark: marks[0],
                other: marks[0],
            })
            expect(result).toBe(true)
        })

        it('should consider different marks not equal', async function () {
            const result = await provenanceMark.markEquals({
                mark: marks[0],
                other: marks[1],
            })
            expect(result).toBe(false)
        })
    })

})
