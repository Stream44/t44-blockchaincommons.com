#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { join } from 'path'
import { rm, mkdir } from 'fs/promises'

const WORK_DIR = join(import.meta.dir, '.~open-integrity-sh')

const {
    test: { describe, it, expect },
    oi
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
                oi: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './open-integrity-sh'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/open-integrity-sh.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

// Clean up before tests
await rm(WORK_DIR, { recursive: true, force: true })
await mkdir(WORK_DIR, { recursive: true })

describe('Open Integrity SH (shell script delegation)', function () {

    const repoDir = join(WORK_DIR, 'test-repo')

    describe('1. setup_git_inception_repo.sh', function () {

        it('should create an inception repo via the shell script', async function () {
            const result = await oi.createInceptionRepo({
                repoDir,
                force: false,
            })

            expect(result.exitCode).toBe(0)
        })

        it('should fail when repo already exists without --force', async function () {
            try {
                await oi.createInceptionRepo({
                    repoDir,
                    force: false,
                })
                expect(true).toBe(false) // should not reach here
            } catch (err: any) {
                expect(err.message).toContain('setup_git_inception_repo.sh failed')
            }
        })

        it('should succeed with --force on existing repo', async function () {
            const forceRepoDir = join(WORK_DIR, 'test-repo-force')
            await oi.createInceptionRepo({ repoDir: forceRepoDir })
            const result = await oi.createInceptionRepo({ repoDir: forceRepoDir, force: true })
            expect(result.exitCode).toBe(0)
        })
    })

    describe('2. get_repo_did.sh', function () {

        it('should retrieve the repo DID', async function () {
            const did = await oi.getRepoDid({ repoDir })

            expect(did).toStartWith('did:repo:')
            expect(did.length).toBeGreaterThan('did:repo:'.length)
        })

        it('should fail on a non-repo directory', async function () {
            const badDir = join('/tmp', 'not-a-git-repo-' + Date.now())
            await mkdir(badDir, { recursive: true })

            try {
                await oi.getRepoDid({ repoDir: badDir })
                expect(true).toBe(false) // should not reach here
            } catch (err: any) {
                expect(err.message).toContain('get_repo_did.sh failed')
            }
        })
    })

    describe('3. audit_inception_commit-POC.sh', function () {

        it('should pass audit on a valid inception repo', async function () {
            const result = await oi.auditInceptionCommit({
                repoDir,
                quiet: true,
                noPrompt: true,
                noColor: true,
            })

            expect(result.passed).toBe(true)
            expect(result.exitCode).toBe(0)
        })

        it('should return verbose output when requested', async function () {
            const result = await oi.auditInceptionCommit({
                repoDir,
                verbose: true,
                noPrompt: true,
                noColor: true,
            })

            expect(result.exitCode).toBe(0)
            expect(result.stdout.length).toBeGreaterThan(0)
        })
    })

    describe('4. snippet_template.sh', function () {

        it('should show file status in default format', async function () {
            const testFile = join(WORK_DIR, 'test-file.txt')
            const { writeFile } = await import('fs/promises')
            await writeFile(testFile, 'hello world')

            const result = await oi.showFileStatus({
                filePath: testFile,
            })

            expect(result.exitCode).toBe(0)
            expect(result.stdout).toContain('File:')
            expect(result.stdout).toContain('Size:')
        })

        it('should show file status in json format', async function () {
            const testFile = join(WORK_DIR, 'test-file.txt')

            const result = await oi.showFileStatus({
                filePath: testFile,
                format: 'json',
            })

            expect(result.exitCode).toBe(0)
            expect(result.stdout).toContain('"file"')
            expect(result.stdout).toContain('"size"')
        })
    })

    describe('5. Cross-script workflow', function () {

        it('should create repo, get DID, and audit in sequence', async function () {
            const workflowRepoDir = join(WORK_DIR, 'workflow-repo')

            // Create inception repo
            const createResult = await oi.createInceptionRepo({ repoDir: workflowRepoDir })
            expect(createResult.exitCode).toBe(0)

            // Get DID
            const did = await oi.getRepoDid({ repoDir: workflowRepoDir })
            expect(did).toStartWith('did:repo:')

            // Audit
            const auditResult = await oi.auditInceptionCommit({
                repoDir: workflowRepoDir,
                quiet: true,
                noPrompt: true,
                noColor: true,
            })
            expect(auditResult.passed).toBe(true)
        })
    })

})
