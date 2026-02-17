

import {
    makeFromUtf8,
    makeFromData,
    makeFromDigest,
    Version,
    Pattern,
    type Image,
    dataToHex,
    hexToData,
    sha256,
    Color,
    Size,
} from '@bcts/lifehash'


export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: {
    encapsulate: any
    CapsulePropertyTypes: any
    makeImportStack: any
}) {

    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {

                makeFromUtf8: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        input: string
                        version?: 'version1' | 'version2' | 'detailed' | 'fiducial' | 'grayscale_fiducial'
                        moduleSize?: number
                        hasAlpha?: boolean
                    }): Promise<Image> {
                        const version = context.version ? Version[context.version] : Version.version2
                        return makeFromUtf8(context.input, version, context.moduleSize ?? 1, context.hasAlpha ?? false)
                    }
                },

                makeFromData: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        data: Uint8Array
                        version?: 'version1' | 'version2' | 'detailed' | 'fiducial' | 'grayscale_fiducial'
                        moduleSize?: number
                        hasAlpha?: boolean
                    }): Promise<Image> {
                        const version = context.version ? Version[context.version] : Version.version2
                        return makeFromData(context.data, version, context.moduleSize ?? 1, context.hasAlpha ?? false)
                    }
                },

                makeFromDigest: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        digest: Uint8Array
                        version?: 'version1' | 'version2' | 'detailed' | 'fiducial' | 'grayscale_fiducial'
                        moduleSize?: number
                        hasAlpha?: boolean
                    }): Promise<Image> {
                        const version = context.version ? Version[context.version] : Version.version2
                        return makeFromDigest(context.digest, version, context.moduleSize ?? 1, context.hasAlpha ?? false)
                    }
                },

                toPPM: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        image: Image
                    }): Promise<Uint8Array> {
                        const { width, height, colors } = context.image
                        const header = `P6\n${width} ${height}\n255\n`
                        const headerBytes = new TextEncoder().encode(header)
                        const pixelCount = width * height
                        const pixelData = new Uint8Array(pixelCount * 3)
                        const channels = colors.length / (width * height)
                        for (let i = 0; i < pixelCount; i++) {
                            pixelData[i * 3] = colors[i * channels]
                            pixelData[i * 3 + 1] = colors[i * channels + 1]
                            pixelData[i * 3 + 2] = colors[i * channels + 2]
                        }
                        const result = new Uint8Array(headerBytes.length + pixelData.length)
                        result.set(headerBytes)
                        result.set(pixelData, headerBytes.length)
                        return result
                    }
                },

                toSVG: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        image: Image
                    }): Promise<string> {
                        const { width, height, colors } = context.image
                        const channels = colors.length / (width * height)
                        const lines: string[] = []
                        lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`)
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                const i = (y * width + x) * channels
                                const r = colors[i]
                                const g = colors[i + 1]
                                const b = colors[i + 2]
                                lines.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${r},${g},${b})"/>`)
                            }
                        }
                        lines.push('</svg>')
                        return lines.join('\n')
                    }
                },

                // Expose library types and utilities for convenience
                types: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any) {
                        return {
                            Version,
                            Pattern,
                            Color,
                            Size,
                            dataToHex,
                            hexToData,
                            sha256,
                        }
                    }
                }

            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/lifehash'
