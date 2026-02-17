#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'

const {
    test: { describe, it, expect, workbenchDir },
    oi,
    gordian,
    key,
    fs
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
                gordian: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './GordianOpenIntegrity'
                },
                key: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './key'
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
        capsuleName: 't44/caps/providers/blockchaincommons.com/open-integrity-sh.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

const repoDir = await fs.join({ parts: [workbenchDir, 'test-repo'] })
const keysDir = await fs.join({ parts: [workbenchDir, 'keys'] })

describe('Open Integrity SH (shell script delegation)', function () {

    describe('1. GordianOpenIntegrity repo compatibility with SH tool', function () {

        it('should create a Gordian Open Integrity repo with BC compatibility and pass SH audit', async function () {
            // Create repo using GordianOpenIntegrity with BC compatibility mode
            const sigKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'inception_key' })
            const provKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'inception_prov' })

            const repoResult = await gordian.createRepository({
                repoDir,
                firstTrustKeyPath: sigKey.privateKeyPath,
                authorName: 'TestAuthor',
                authorEmail: 'test@example.com',
                provenanceKeyPath: provKey.privateKeyPath,
                blockchainCommonsCompatibility: true,
            })

            // Verify the SH tool can extract DID from Gordian repo
            const did = await oi.getRepoDid({ repoDir })
            expect(did).toStartWith('did:repo:')
            expect(did.length).toBeGreaterThan('did:repo:'.length)

            // Verify DID matches the repository identifier
            const expectedDid = repoResult.did
            expect(did).toBe(expectedDid)

            // Add the Gordian signing key to the SH tool's allowed_signers file
            // The SH tool uses a global allowed_signers file at /tmp/.open-integrity-sh-signing/allowed_signers
            const tmpBase = await fs.tmpdir()
            const shAllowedSignersPath = await fs.join({ parts: [tmpBase, '.open-integrity-sh-signing', 'allowed_signers'] })
            const gordianKeyEntry = `test@example.com namespaces="git" ${sigKey.publicKey}\n`
            await fs.appendFile({ path: shAllowedSignersPath, content: gordianKeyEntry })

            // Verify the inception commit passes SH audit
            const auditResult = await oi.auditInceptionCommit({
                repoDir,
                quiet: false,
                noPrompt: true,
                noColor: true,
            })

            if (!auditResult.passed) {
                console.log('Audit failed. Output:', auditResult.stdout)
            }

            expect(auditResult.passed).toBe(true)
            expect(auditResult.exitCode).toBe(0)
        })

        it('should verify Gordian repo using GordianOpenIntegrity capsule', async function () {
            // Use GordianOpenIntegrity's own verify method
            const verifyResult = await gordian.verify({ repoDir })
            expect(verifyResult.valid).toBe(true)
            expect(verifyResult.did).toStartWith('did:repo:')
        })
    })

    describe('2. get_repo_did.sh', function () {

        it('should retrieve the repo DID', async function () {
            const did = await oi.getRepoDid({ repoDir })

            expect(did).toStartWith('did:repo:')
            expect(did.length).toBeGreaterThan('did:repo:'.length)
        })

        it('should fail on a non-repo directory', async function () {
            const badDir = await fs.join({ parts: ['/tmp', 'not-a-git-repo-' + Date.now()] })
            await fs.mkdir({ path: badDir })

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
            if (!process.stdin.isTTY || process.env.CI) {
                console.log('\n   ⚠️  Skipping test: snippet_template.sh requires BSD stat (macOS only)')
                expect(true).toBe(true)
                return
            }

            const testFile = await fs.join({ parts: [workbenchDir, 'test-file.txt'] })
            await fs.writeFile({ path: testFile, content: 'hello world' })

            const result = await oi.showFileStatus({
                filePath: testFile,
            })

            expect(result.exitCode).toBe(0)
            expect(result.stdout).toContain('File:')
            expect(result.stdout).toContain('Size:')
        })

        it('should show file status in json format', async function () {
            if (!process.stdin.isTTY || process.env.CI) {
                console.log('\n   ⚠️  Skipping test: snippet_template.sh requires BSD stat (macOS only)')
                expect(true).toBe(true)
                return
            }

            const testFile = await fs.join({ parts: [workbenchDir, 'test-file.txt'] })

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
            const workflowRepoDir = await fs.join({ parts: [workbenchDir, 'workflow-repo'] })

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
