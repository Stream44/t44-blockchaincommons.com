


import { join, dirname, resolve, basename } from 'path'
import { mkdir, writeFile, readFile, rm, access, chmod, appendFile } from 'fs/promises'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import * as crypto from 'crypto'

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

                // ── Path operations ──────────────────────────────────

                join: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { parts: string[] }): Promise<string> {
                        return join(...context.parts)
                    }
                },

                dirname: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string }): Promise<string> {
                        return dirname(context.path)
                    }
                },

                resolve: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { parts: string[] }): Promise<string> {
                        return resolve(...context.parts)
                    }
                },

                basename: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; ext?: string }): Promise<string> {
                        return basename(context.path, context.ext)
                    }
                },

                tmpdir: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any): Promise<string> {
                        return tmpdir()
                    }
                },

                fileURLToPath: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { url: string }): Promise<string> {
                        return fileURLToPath(context.url)
                    }
                },

                // ── File system operations (async only) ──────────────

                mkdir: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; recursive?: boolean }) {
                        await mkdir(context.path, { recursive: context.recursive ?? true })
                    }
                },

                writeFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; content: string; encoding?: string }) {
                        await writeFile(context.path, context.content, (context.encoding || 'utf-8') as BufferEncoding)
                    }
                },

                readFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; encoding?: string }): Promise<string> {
                        return readFile(context.path, (context.encoding || 'utf-8') as BufferEncoding)
                    }
                },

                readFileBuffer: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string }): Promise<Buffer> {
                        return readFile(context.path) as Promise<Buffer>
                    }
                },

                rm: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; recursive?: boolean; force?: boolean }) {
                        await rm(context.path, { recursive: context.recursive, force: context.force })
                    }
                },

                exists: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string }): Promise<boolean> {
                        return access(context.path).then(() => true).catch(() => false)
                    }
                },

                chmod: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; mode: number }) {
                        await chmod(context.path, context.mode)
                    }
                },

                appendFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; content: string }) {
                        await appendFile(context.path, context.content)
                    }
                },

                // ── JSON file helpers ────────────────────────────────

                writeJson: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string; data: any; indent?: number }) {
                        const dirPath = dirname(context.path)
                        await mkdir(dirPath, { recursive: true })
                        await writeFile(context.path, JSON.stringify(context.data, null, context.indent ?? 2))
                    }
                },

                readJson: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { path: string }): Promise<any> {
                        const content = await readFile(context.path, 'utf-8')
                        return JSON.parse(content)
                    }
                },

                // ── Crypto helpers ───────────────────────────────────

                sha256: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { data: Uint8Array | Buffer | string }): Promise<Uint8Array> {
                        return new Uint8Array(crypto.createHash('sha256').update(context.data).digest())
                    }
                },

                sha256Hex: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { data: Uint8Array | Buffer | string }): Promise<string> {
                        return crypto.createHash('sha256').update(context.data).digest('hex')
                    }
                },

                randomBytes: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { size: number }): Promise<Buffer> {
                        return crypto.randomBytes(context.size)
                    }
                },

                encryptAes256Gcm: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { key: Uint8Array; plaintext: string }): Promise<string> {
                        const fp = crypto.createHash('sha256').update(context.key).digest('hex').slice(0, 8)
                        const iv = crypto.randomBytes(12)
                        const cipher = crypto.createCipheriv('aes-256-gcm', context.key, iv)
                        const encrypted = Buffer.concat([cipher.update(context.plaintext, 'utf8'), cipher.final()])
                        const tag = cipher.getAuthTag()
                        const combined = Buffer.concat([iv, encrypted, tag])
                        return `aes-256-gcm:${fp}:${combined.toString('base64')}`
                    }
                },

                decryptAes256Gcm: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { key: Uint8Array; ciphertext: string }): Promise<string> {
                        const parts = context.ciphertext.split(':')
                        const combined = Buffer.from(parts[2], 'base64')
                        const iv = combined.subarray(0, 12)
                        const tag = combined.subarray(combined.length - 16)
                        const data = combined.subarray(12, combined.length - 16)
                        const decipher = crypto.createDecipheriv('aes-256-gcm', context.key, iv)
                        decipher.setAuthTag(tag)
                        return decipher.update(data).toString('utf8') + decipher.final('utf8')
                    }
                },

            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/fs'
