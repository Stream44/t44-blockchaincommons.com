#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/workspace-rt'
import { join } from 'path'
import { rm, mkdir, writeFile } from 'fs/promises'

const WORK_DIR = join(import.meta.dir, '.~lifehash')

const {
    test: { describe, it, expect },
    lifehash,
    provenanceMark,
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
                lifehash: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './lifehash'
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
        capsuleName: 't44/caps/providers/blockchaincommons.com/lifehash.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

await rm(WORK_DIR, { recursive: true, force: true })
await mkdir(WORK_DIR, { recursive: true })

describe('LifeHash Capsule', function () {

    // ──────────────────────────────────────────────────────────────────
    // 1. Basic image generation
    // ──────────────────────────────────────────────────────────────────

    describe('1. makeFromUtf8', function () {

        it('should generate an image from a string', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'hello world' })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)
            expect(image.colors).toBeInstanceOf(Uint8Array)
            expect(image.colors.length).toBe(32 * 32 * 3)

            const ppm = await lifehash.toPPM({ image })
            await writeFile(join(WORK_DIR, 'hello-world.ppm'), ppm)
            const svg = await lifehash.toSVG({ image })
            await writeFile(join(WORK_DIR, 'hello-world.svg'), svg)
        })

        it('should generate a larger image with moduleSize', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'hello world', moduleSize: 4 })
            expect(image.width).toBe(128)
            expect(image.height).toBe(128)
            expect(image.colors.length).toBe(128 * 128 * 3)
        })

        it('should generate an image with alpha channel', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'hello world', hasAlpha: true })
            expect(image.colors.length).toBe(32 * 32 * 4)
        })

        it('should produce deterministic output for the same input', async function () {
            const image1 = await lifehash.makeFromUtf8({ input: 'deterministic' })
            const image2 = await lifehash.makeFromUtf8({ input: 'deterministic' })
            expect(image1.colors).toEqual(image2.colors)
        })

        it('should produce different output for different inputs', async function () {
            const image1 = await lifehash.makeFromUtf8({ input: 'alpha' })
            const image2 = await lifehash.makeFromUtf8({ input: 'beta' })
            expect(image1.colors).not.toEqual(image2.colors)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 2. Version variants
    // ──────────────────────────────────────────────────────────────────

    describe('2. Version variants', function () {

        it('should generate version1 image', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'test', version: 'version1' })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)
            await writeFile(join(WORK_DIR, 'version1.svg'), await lifehash.toSVG({ image }))
        })

        it('should generate detailed image (32x32)', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'test', version: 'detailed' })
            expect(image.width).toBe(64)
            expect(image.height).toBe(64)
            await writeFile(join(WORK_DIR, 'detailed.svg'), await lifehash.toSVG({ image }))
        })

        it('should generate fiducial image (32x32)', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'test', version: 'fiducial' })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)
            await writeFile(join(WORK_DIR, 'fiducial.svg'), await lifehash.toSVG({ image }))
        })

        it('should generate grayscale fiducial image', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'test', version: 'grayscale_fiducial' })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)
            await writeFile(join(WORK_DIR, 'grayscale-fiducial.svg'), await lifehash.toSVG({ image }))
        })

        it('should produce different images for different versions', async function () {
            const v1 = await lifehash.makeFromUtf8({ input: 'same', version: 'version1' })
            const v2 = await lifehash.makeFromUtf8({ input: 'same', version: 'version2' })
            expect(v1.colors).not.toEqual(v2.colors)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 3. makeFromData
    // ──────────────────────────────────────────────────────────────────

    describe('3. makeFromData', function () {

        it('should generate an image from raw bytes', async function () {
            const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
            const image = await lifehash.makeFromData({ data })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)
            expect(image.colors.length).toBe(32 * 32 * 3)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 4. makeFromDigest
    // ──────────────────────────────────────────────────────────────────

    describe('4. makeFromDigest', function () {

        it('should generate an image from a 32-byte digest', async function () {
            const { sha256 } = await lifehash.types()
            const digest = sha256(new TextEncoder().encode('hello'))
            expect(digest.length).toBe(32)

            const image = await lifehash.makeFromDigest({ digest })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)
        })

        it('should reject a non-32-byte digest', async function () {
            const badDigest = new Uint8Array(16)
            await expect(lifehash.makeFromDigest({ digest: badDigest })).rejects.toThrow('32 bytes')
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 5. LifeHash from provenance mark
    // ──────────────────────────────────────────────────────────────────

    describe('5. LifeHash from provenance mark', function () {

        let mark: any
        let markIdentifier: string

        it('should create a provenance mark', async function () {
            const generator = await provenanceMark.createGenerator({
                type: 'passphrase',
                passphrase: 'lifehash-test-chain',
            })
            mark = await provenanceMark.nextMark({
                generator,
                date: new Date(Date.UTC(2025, 0, 1)),
            })
            expect(mark).toBeDefined()
        })

        it('should get mark identifier string', async function () {
            markIdentifier = await provenanceMark.getIdentifier({ mark })
            expect(typeof markIdentifier).toBe('string')
            expect(markIdentifier.length).toBeGreaterThan(0)
        })

        it('should generate a lifehash image from the mark identifier', async function () {
            const image = await lifehash.makeFromUtf8({ input: markIdentifier })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)
            expect(image.colors).toBeInstanceOf(Uint8Array)
            expect(image.colors.length).toBe(32 * 32 * 3)

            await writeFile(join(WORK_DIR, 'provenance-mark-identifier.svg'), await lifehash.toSVG({ image }))
            await writeFile(join(WORK_DIR, 'provenance-mark-identifier.ppm'), await lifehash.toPPM({ image }))
        })

        it('should generate a lifehash from the mark hash bytes', async function () {
            const hashBytes = await provenanceMark.getHash({ mark })
            expect(hashBytes).toBeInstanceOf(Uint8Array)

            const image = await lifehash.makeFromData({ data: hashBytes })
            expect(image.width).toBe(32)
            expect(image.height).toBe(32)

            await writeFile(join(WORK_DIR, 'provenance-mark-hash.svg'), await lifehash.toSVG({ image }))
        })

        it('should produce a deterministic lifehash for the same mark', async function () {
            const image1 = await lifehash.makeFromUtf8({ input: markIdentifier })
            const image2 = await lifehash.makeFromUtf8({ input: markIdentifier })
            expect(image1.colors).toEqual(image2.colors)
        })

        it('should produce different lifehashes for different marks', async function () {
            const generator = await provenanceMark.createGenerator({
                type: 'passphrase',
                passphrase: 'different-chain',
            })
            const otherMark = await provenanceMark.nextMark({
                generator,
                date: new Date(Date.UTC(2025, 0, 1)),
            })
            const otherIdentifier = await provenanceMark.getIdentifier({ mark: otherMark })

            const image1 = await lifehash.makeFromUtf8({ input: markIdentifier })
            const image2 = await lifehash.makeFromUtf8({ input: otherIdentifier })
            expect(image1.colors).not.toEqual(image2.colors)
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 6. Output formats
    // ──────────────────────────────────────────────────────────────────

    describe('6. Output formats', function () {

        it('should convert image to PPM format', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'ppm-test' })
            const ppm = await lifehash.toPPM({ image })
            expect(ppm).toBeInstanceOf(Uint8Array)

            const header = new TextDecoder().decode(ppm.slice(0, 20))
            expect(header.startsWith('P6\n32 32\n255\n')).toBe(true)

            const headerLength = new TextEncoder().encode('P6\n32 32\n255\n').length
            expect(ppm.length).toBe(headerLength + 32 * 32 * 3)
        })

        it('should convert image to SVG format', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'svg-test' })
            const svg = await lifehash.toSVG({ image })
            expect(typeof svg).toBe('string')
            expect(svg).toContain('<svg')
            expect(svg).toContain('viewBox="0 0 32 32"')
            expect(svg).toContain('</svg>')
            expect(svg).toContain('<rect')
            expect(svg).toContain('fill="rgb(')
        })

        it('should produce valid SVG for scaled images', async function () {
            const image = await lifehash.makeFromUtf8({ input: 'svg-scaled', moduleSize: 2 })
            const svg = await lifehash.toSVG({ image })
            expect(svg).toContain('viewBox="0 0 64 64"')
        })
    })

    // ──────────────────────────────────────────────────────────────────
    // 7. Types exposure
    // ──────────────────────────────────────────────────────────────────

    describe('7. Types', function () {

        it('should expose library types', async function () {
            const types = await lifehash.types()
            expect(types.Version).toBeDefined()
            expect(types.Pattern).toBeDefined()
            expect(types.sha256).toBeDefined()
            expect(types.dataToHex).toBeDefined()
            expect(types.hexToData).toBeDefined()
        })
    })

})
