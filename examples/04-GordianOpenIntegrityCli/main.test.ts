#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect, workbenchDir },
    fs,
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/ProjectTest',
                    options: {
                        '#': {
                            bunTest,
                            env: {}
                        }
                    }
                },
                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/fs'
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

const REPO_DIR = `${workbenchDir}/repo`
const KEYS_DIR = `${workbenchDir}/keys`
const OI_BIN = await fs.join({ parts: [import.meta.dir, '../../bin/oi'] })

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

    it('should init a repository with --first-trust-key and --provenance-key', async function () {
        // Clean up and prepare directories
        await fs.mkdir({ path: REPO_DIR, recursive: true })
        await fs.mkdir({ path: KEYS_DIR, recursive: true })

        // Generate test SSH keys
        const keyPath = await fs.join({ parts: [KEYS_DIR, 'test_ed25519'] })
        const provKeyPath = await fs.join({ parts: [KEYS_DIR, 'prov_ed25519'] })
        const keygenProc = Bun.spawn(['ssh-keygen', '-t', 'ed25519', '-f', keyPath, '-N', '', '-C', 'test_ed25519'], {
            stdout: 'pipe',
            stderr: 'pipe',
        })
        await keygenProc.exited
        const provKeygenProc = Bun.spawn(['ssh-keygen', '-t', 'ed25519', '-f', provKeyPath, '-N', '', '-C', 'prov_ed25519'], {
            stdout: 'pipe',
            stderr: 'pipe',
        })
        await provKeygenProc.exited

        // Run the init command
        const proc = Bun.spawn(['bun', OI_BIN, 'init', 'GordianOpenIntegrity', '--first-trust-key', keyPath, '--provenance-key', provKeyPath], {
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
        const provenancePath = await fs.join({ parts: [REPO_DIR, '.o', 'GordianOpenIntegrity.yaml'] })
        expect(await fs.exists({ path: provenancePath })).toBe(true)
        const content = await fs.readFile({ path: provenancePath })
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
