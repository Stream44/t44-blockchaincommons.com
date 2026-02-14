#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/workspace-rt'
import { join } from 'path'
import { rm, mkdir, readFile, access } from 'fs/promises'

const WORK_DIR = join(import.meta.dir, '.~open-integrity-cli')
const REPO_DIR = join(WORK_DIR, 'repo')
const KEYS_DIR = join(WORK_DIR, 'keys')
const OI_BIN = join(import.meta.dir, '../../bin/oi')

const {
    test: { describe, it, expect },
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
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: '@stream44.studio/t44-blockchaincommons.com/examples/04-GordianOpenIntegrityCli'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

describe('GordianOpenIntegrity CLI', function () {

    it('should display help when no command is provided', async function () {
        const proc = Bun.spawn(['bun', OI_BIN], {
            stdout: 'pipe',
            stderr: 'pipe',
        })
        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        await proc.exited
        const output = stdout + stderr
        expect(output).toContain('Gordian Open Integrity CLI')
    })

    it('should init a repository with --inception-key', async function () {
        // Clean up and prepare directories
        await rm(WORK_DIR, { recursive: true, force: true })
        await mkdir(REPO_DIR, { recursive: true })
        await mkdir(KEYS_DIR, { recursive: true })

        // Generate a test SSH key
        const keyPath = join(KEYS_DIR, 'test_ed25519')
        const keygenProc = Bun.spawn(['ssh-keygen', '-t', 'ed25519', '-f', keyPath, '-N', '', '-C', 'test_ed25519'], {
            stdout: 'pipe',
            stderr: 'pipe',
        })
        await keygenProc.exited

        // Run the init command
        const proc = Bun.spawn(['bun', OI_BIN, 'init', 'GordianOpenIntegrity', '--inception-key', keyPath], {
            cwd: REPO_DIR,
            stdout: 'pipe',
            stderr: 'pipe',
        })
        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        const output = stdout + stderr
        if (exitCode !== 0) {
            console.error('CLI output:', output)
        }
        expect(exitCode).toBe(0)
        expect(output).toContain('Gordian Open Integrity repository initialized')
        expect(output).toContain('DID:')
        expect(output).toContain('Mark:')

        // Verify the repo was created with expected files
        const provenancePath = join(REPO_DIR, '.o', 'GordianOpenIntegrity.yaml')
        await access(provenancePath)
        const content = await readFile(provenancePath, 'utf-8')
        expect(content).toContain('envelope')
        expect(content).toContain('mark')
    })

    it('should validate a repository after init', async function () {
        // Run the validate command on the repo initialized above
        const proc = Bun.spawn(['bun', OI_BIN, 'validate', 'GordianOpenIntegrity'], {
            cwd: REPO_DIR,
            stdout: 'pipe',
            stderr: 'pipe',
        })
        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        const output = stdout + stderr
        if (exitCode !== 0) {
            console.error('CLI output:', output)
        }
        expect(exitCode).toBe(0)
        expect(output).toContain('Repository integrity verified')
        expect(output).toContain('XID:')
        expect(output).toContain('Commits:')
    })
})
