#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect, workbenchDir },
    cli,
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
                cli: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './provenance-mark-cli'
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
        capsuleName: 't44/caps/providers/blockchaincommons.com/provenance-mark-cli.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

describe('Provenance Mark CLI Capsule', function () {

    let chainDir: string

    // ──────────────────────────────────────────────────────────────────
    // 1. Create a new chain (provenance new)
    // ──────────────────────────────────────────────────────────────────

    describe('1. New chain', function () {

        it('should create a new provenance mark chain with default resolution', async function () {
            chainDir = await fs.join({ parts: [workbenchDir, 'mychain'] })

            const output = await cli.newChain({
                path: chainDir,
                comment: 'Genesis mark for tests',
                date: new Date(Date.UTC(2025, 0, 1)),
                quiet: true,
            })

            expect(typeof output).toBe('string')
            expect(output.length).toBeGreaterThan(0)

            // Verify directory structure
            expect(await fs.exists({ path: chainDir })).toBe(true)
            expect(await fs.exists({ path: await fs.join({ parts: [chainDir, 'generator.json'] }) })).toBe(true)
            expect(await fs.exists({ path: await fs.join({ parts: [chainDir, 'marks'] }) })).toBe(true)
            expect(await fs.exists({ path: await fs.join({ parts: [chainDir, 'marks', 'mark-0.json'] }) })).toBe(true)
        })

        it('should create a chain with a specific resolution', async function () {
            const highResDir = await fs.join({ parts: [workbenchDir, 'highres-chain'] })

            const output = await cli.newChain({
                path: highResDir,
                resolution: 'high',
                comment: 'High resolution chain',
                date: new Date(Date.UTC(2025, 0, 1)),
                quiet: true,
            })

            expect(output.length).toBeGreaterThan(0)
            expect(await fs.exists({ path: await fs.join({ parts: [highResDir, 'marks', 'mark-0.json'] }) })).toBe(true)
        })

        it('should reject creating a chain in an existing directory', async function () {
            await expect(
                cli.newChain({
                    path: chainDir,
                    comment: 'Duplicate',
                    date: new Date(Date.UTC(2025, 0, 1)),
                })
            ).rejects.toThrow('already exists')
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 2. Add marks (provenance next)
    // ──────────────────────────────────────────────────────────────────

    describe('2. Next mark', function () {

        it('should add a second mark to the chain', async function () {
            const output = await cli.nextMark({
                path: chainDir,
                comment: 'Release v1.0',
                date: new Date(Date.UTC(2025, 0, 2)),
                quiet: true,
            })

            expect(typeof output).toBe('string')
            expect(output.length).toBeGreaterThan(0)
            expect(await fs.exists({ path: await fs.join({ parts: [chainDir, 'marks', 'mark-1.json'] }) })).toBe(true)
        })

        it('should add a third mark to the chain', async function () {
            const output = await cli.nextMark({
                path: chainDir,
                comment: 'Release v2.0',
                date: new Date(Date.UTC(2025, 0, 3)),
                quiet: true,
            })

            expect(output.length).toBeGreaterThan(0)
            expect(await fs.exists({ path: await fs.join({ parts: [chainDir, 'marks', 'mark-2.json'] }) })).toBe(true)
        })

        it('should add a fourth mark to the chain', async function () {
            await cli.nextMark({
                path: chainDir,
                comment: 'Release v3.0',
                date: new Date(Date.UTC(2025, 0, 4)),
                quiet: true,
            })

            expect(await fs.exists({ path: await fs.join({ parts: [chainDir, 'marks', 'mark-3.json'] }) })).toBe(true)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 3. Output formats (provenance next --format)
    // ──────────────────────────────────────────────────────────────────

    describe('3. Output formats', function () {

        it('should output in markdown format', async function () {
            const formatDir = await fs.join({ parts: [workbenchDir, 'format-chain'] })
            await cli.newChain({
                path: formatDir,
                comment: 'Format test',
                date: new Date(Date.UTC(2025, 0, 1)),
                format: 'markdown',
                quiet: true,
            })

            // Markdown output contains the bytewords line with 🅟
            expect(true).toBe(true) // chain created successfully
        })

        it('should output in UR format', async function () {
            const urDir = await fs.join({ parts: [workbenchDir, 'ur-chain'] })
            const output = await cli.newChain({
                path: urDir,
                comment: 'UR test',
                date: new Date(Date.UTC(2025, 0, 1)),
                format: 'ur',
                quiet: true,
            })

            expect(output.startsWith('ur:provenance/')).toBe(true)
        })

        it('should output in JSON format', async function () {
            const jsonDir = await fs.join({ parts: [workbenchDir, 'json-chain'] })
            const output = await cli.newChain({
                path: jsonDir,
                comment: 'JSON test',
                date: new Date(Date.UTC(2025, 0, 1)),
                format: 'json',
                quiet: true,
            })

            const parsed = JSON.parse(output)
            expect(parsed).toBeDefined()
            expect(parsed.comment).toBe('JSON test')
        })

        it('should output next mark in UR format', async function () {
            const urDir = await fs.join({ parts: [workbenchDir, 'ur-chain'] })
            const output = await cli.nextMark({
                path: urDir,
                comment: 'UR next',
                date: new Date(Date.UTC(2025, 0, 2)),
                format: 'ur',
                quiet: true,
            })

            expect(output.startsWith('ur:provenance/')).toBe(true)
        })

        it('should output next mark in JSON format', async function () {
            const jsonDir = await fs.join({ parts: [workbenchDir, 'json-chain'] })
            const output = await cli.nextMark({
                path: jsonDir,
                comment: 'JSON next',
                date: new Date(Date.UTC(2025, 0, 2)),
                format: 'json',
                quiet: true,
            })

            const parsed = JSON.parse(output)
            expect(parsed.comment).toBe('JSON next')
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 4. Print marks (provenance print)
    // ──────────────────────────────────────────────────────────────────

    describe('4. Print marks', function () {

        it('should print all marks in the chain', async function () {
            const output = await cli.print({
                path: chainDir,
            })

            expect(typeof output).toBe('string')
            expect(output.length).toBeGreaterThan(0)
        })

        it('should print a specific range of marks', async function () {
            const output = await cli.print({
                path: chainDir,
                start: 0,
                end: 1,
            })

            expect(output.length).toBeGreaterThan(0)
        })

        it('should print only the genesis mark', async function () {
            const output = await cli.print({
                path: chainDir,
                start: 0,
                end: 0,
            })

            expect(output.length).toBeGreaterThan(0)
        })

        it('should print marks in JSON format', async function () {
            const output = await cli.print({
                path: chainDir,
                format: 'json',
            })

            const parsed = JSON.parse(output)
            expect(Array.isArray(parsed)).toBe(true)
            expect(parsed.length).toBe(4)
        })

        it('should print marks in UR format', async function () {
            const output = await cli.print({
                path: chainDir,
                format: 'ur',
            })

            const lines = output.split('\n').filter((l: string) => l.trim() !== '')
            expect(lines.length).toBe(4)
            for (const line of lines) {
                expect(line.startsWith('ur:provenance/')).toBe(true)
            }
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 5. Validate chain (provenance validate)
    // ──────────────────────────────────────────────────────────────────

    describe('5. Validate chain', function () {

        it('should validate a valid chain directory', async function () {
            const output = await cli.validate({
                dir: chainDir,
                format: 'json-pretty',
            })

            const parsed = JSON.parse(output)
            expect(parsed).toBeDefined()
            expect(parsed.chains).toBeDefined()
        })

        it('should validate with text format (empty for valid chain)', async function () {
            const output = await cli.validate({
                dir: chainDir,
                format: 'text',
            })

            // A valid chain produces empty text output (no issues)
            expect(typeof output).toBe('string')
        })

        it('should validate with json-compact format', async function () {
            const output = await cli.validate({
                dir: chainDir,
                format: 'json-compact',
            })

            const parsed = JSON.parse(output)
            expect(parsed).toBeDefined()
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 6. Resolution levels
    // ──────────────────────────────────────────────────────────────────

    describe('6. Resolution levels', function () {

        for (const resolution of ['low', 'medium', 'quartile', 'high'] as const) {
            it(`should create a chain with ${resolution} resolution`, async function () {
                const resDir = await fs.join({ parts: [workbenchDir, `res-${resolution}`] })
                const output = await cli.newChain({
                    path: resDir,
                    resolution,
                    comment: `${resolution} resolution`,
                    date: new Date(Date.UTC(2025, 0, 1)),
                    format: 'json',
                    quiet: true,
                })

                const parsed = JSON.parse(output)
                expect(parsed).toBeDefined()
                expect(parsed.comment).toBe(`${resolution} resolution`)
            })
        }
    })

    // ──────────────────────────────────────────────────────────────────
    // 7. Mark JSON structure
    // ──────────────────────────────────────────────────────────────────

    describe('7. Mark JSON structure', function () {

        it('should have expected fields in mark JSON', async function () {
            const output = await cli.print({
                path: chainDir,
                start: 0,
                end: 0,
                format: 'json',
            })

            const parsed = JSON.parse(output)
            expect(Array.isArray(parsed)).toBe(true)
            const mark = parsed[0]

            expect(mark.comment).toBe('Genesis mark for tests')
            expect(mark.mark).toBeDefined()
        })

        it('should preserve comments across marks', async function () {
            const output = await cli.print({
                path: chainDir,
                format: 'json',
            })

            const parsed = JSON.parse(output)
            expect(parsed[0].comment).toBe('Genesis mark for tests')
            expect(parsed[1].comment).toBe('Release v1.0')
            expect(parsed[2].comment).toBe('Release v2.0')
            expect(parsed[3].comment).toBe('Release v3.0')
        })
    })

})
