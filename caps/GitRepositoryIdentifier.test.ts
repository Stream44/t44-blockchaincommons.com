#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/standalone-rt'
import { execSync } from 'child_process'

const {
    test: { describe, it, expect, workbenchDir },
    ri,
    key,
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
                ri: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './GitRepositoryIdentifier'
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
        capsuleName: 't44/caps/patterns/blockchaincommons.com/GitRepositoryIdentifier.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

describe('GitRepositoryIdentifier', function () {

    const keysDir = `${workbenchDir}/keys`
    let signingKey: any

    describe('Setup', function () {
        it('should generate a signing key', async function () {
            signingKey = await key.generateSigningKey({ keyDir: keysDir, keyName: 'test_ed25519' })
            expect(signingKey.publicKey).toContain('ssh-ed25519')
        })
    })

    describe('1. Create identifier on new repo', function () {

        const repoDir = `${workbenchDir}/repo-new`
        let result: any

        it('should create identifier commit and .repo-identifier file', async function () {
            result = await ri.createIdentifier({
                repoDir,
                signingKeyPath: signingKey.privateKeyPath,
                authorName: '@TestUser',
                authorEmail: 'test@example.com',
            })

            expect(result.commitHash).toBeDefined()
            expect(result.commitHash.length).toBe(40)
            expect(result.did).toBe(`did:repo:${result.commitHash}`)
            expect(result.fingerprint).toContain('SHA256:')
        })

        it('should have written .repo-identifier with the DID', async function () {
            const content = (await fs.readFile({ path: await fs.join({ parts: [repoDir, '.repo-identifier'] }) })).trim()
            expect(content).toBe(result.did)
        })

        it('should read identifier via getIdentifier', async function () {
            const id = await ri.getIdentifier({ repoDir })
            expect(id.did).toBe(result.did)
            expect(id.commitHash).toBe(result.commitHash)
        })

        it('should list 1 identifier via getIdentifiers', async function () {
            const ids = await ri.getIdentifiers({ repoDir })
            expect(ids.count).toBe(1)
            expect(ids.identifiers[0].did).toBe(result.did)
        })

        it('should validate the identifier commit', async function () {
            const v = await ri.validateIdentifier({ repoDir })
            expect(v.valid).toBe(true)
            expect(v.isSigned).toBe(true)
            expect(v.isEmpty).toBe(true)
            expect(v.did).toBe(result.did)
        })
    })

    describe('2. Create identifier on existing repo', function () {

        const repoDir = `${workbenchDir}/repo-existing`
        let readmeCommitHash: string
        let identifierResult: any

        it('should init repo and add a README first', async function () {
            execSync(`git init ${repoDir}`, { stdio: 'pipe' })
            const readmePath = await fs.join({ parts: [repoDir, 'README.md'] })
            await fs.writeFile({ path: readmePath, content: '# Test Repo\n' })
            execSync(`git -C ${repoDir} add README.md`, { stdio: 'pipe' })
            execSync(`git -C ${repoDir} -c gpg.format=ssh -c user.signingkey=${signingKey.privateKeyPath} commit --gpg-sign --signoff -m "Add README.md"`, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    GIT_AUTHOR_NAME: '@TestUser',
                    GIT_AUTHOR_EMAIL: 'test@example.com',
                    GIT_COMMITTER_NAME: '@TestUser',
                    GIT_COMMITTER_EMAIL: 'test@example.com',
                },
            })

            readmeCommitHash = execSync(`git -C ${repoDir} rev-parse HEAD`, { encoding: 'utf-8' }).trim()
            expect(readmeCommitHash).toBeDefined()
        })

        it('should create identifier after existing commits', async function () {
            identifierResult = await ri.createIdentifier({
                repoDir,
                signingKeyPath: signingKey.privateKeyPath,
                authorName: '@TestUser',
                authorEmail: 'test@example.com',
            })

            expect(identifierResult.commitHash).toBeDefined()
            expect(identifierResult.commitHash).not.toBe(readmeCommitHash)
        })

        it('should read the identifier', async function () {
            const id = await ri.getIdentifier({ repoDir })
            expect(id.did).toBe(identifierResult.did)
        })

        it('should validate the identifier commit is signed and empty', async function () {
            const v = await ri.validateIdentifier({ repoDir })
            expect(v.valid).toBe(true)
            expect(v.isSigned).toBe(true)
            expect(v.isEmpty).toBe(true)
        })
    })

    describe('3. Multiple identifiers', function () {

        const repoDir = `${workbenchDir}/repo-multiple`
        let firstId: any
        let secondId: any

        it('should create first identifier', async function () {
            firstId = await ri.createIdentifier({
                repoDir,
                signingKeyPath: signingKey.privateKeyPath,
                authorName: '@TestUser',
                authorEmail: 'test@example.com',
            })
            expect(firstId.commitHash).toBeDefined()
        })

        it('should add a file between identifiers', async function () {
            const dataPath = await fs.join({ parts: [repoDir, 'data.txt'] })
            await fs.writeFile({ path: dataPath, content: 'some data\n' })
            execSync(`git -C ${repoDir} add data.txt`, { stdio: 'pipe' })
            execSync(`git -C ${repoDir} -c gpg.format=ssh -c user.signingkey=${signingKey.privateKeyPath} commit --gpg-sign --signoff -m "Add data file"`, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    GIT_AUTHOR_NAME: '@TestUser',
                    GIT_AUTHOR_EMAIL: 'test@example.com',
                    GIT_COMMITTER_NAME: '@TestUser',
                    GIT_COMMITTER_EMAIL: 'test@example.com',
                },
            })
        })

        it('should create second identifier', async function () {
            secondId = await ri.createIdentifier({
                repoDir,
                signingKeyPath: signingKey.privateKeyPath,
                authorName: '@TestUser',
                authorEmail: 'test@example.com',
            })
            expect(secondId.commitHash).not.toBe(firstId.commitHash)
        })

        it('should return the latest identifier via getIdentifier', async function () {
            const id = await ri.getIdentifier({ repoDir })
            expect(id.did).toBe(secondId.did)
        })

        it('should list both identifiers via getIdentifiers', async function () {
            const ids = await ri.getIdentifiers({ repoDir })
            expect(ids.count).toBe(2)

            const dids = ids.identifiers.map((i: any) => i.did)
            expect(dids).toContain(firstId.did)
            expect(dids).toContain(secondId.did)
        })

        it('should validate both identifier commits', async function () {
            const v1 = await ri.validateIdentifier({ repoDir, commitHash: firstId.commitHash })
            expect(v1.valid).toBe(true)

            const v2 = await ri.validateIdentifier({ repoDir, commitHash: secondId.commitHash })
            expect(v2.valid).toBe(true)
        })
    })

    describe('4. Validation edge cases', function () {

        const repoDir = `${workbenchDir}/repo-validation`

        it('should detect a non-empty commit as invalid identifier', async function () {
            execSync(`git init ${repoDir}`, { stdio: 'pipe' })

            // Create a normal commit with file changes
            const filePath = await fs.join({ parts: [repoDir, 'file.txt'] })
            await fs.writeFile({ path: filePath, content: 'content\n' })
            execSync(`git -C ${repoDir} add file.txt`, { stdio: 'pipe' })
            execSync(`git -C ${repoDir} -c gpg.format=ssh -c user.signingkey=${signingKey.privateKeyPath} commit --gpg-sign --signoff -m "Add file"`, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    GIT_AUTHOR_NAME: '@TestUser',
                    GIT_AUTHOR_EMAIL: 'test@example.com',
                    GIT_COMMITTER_NAME: '@TestUser',
                    GIT_COMMITTER_EMAIL: 'test@example.com',
                },
            })
            const commitHash = execSync(`git -C ${repoDir} rev-parse HEAD`, { encoding: 'utf-8' }).trim()

            // Manually write .repo-identifier pointing to a non-empty commit
            await fs.writeFile({ path: await fs.join({ parts: [repoDir, '.repo-identifier'] }), content: `did:repo:${commitHash}\n` })

            const v = await ri.validateIdentifier({ repoDir })
            expect(v.valid).toBe(false)
            expect(v.isSigned).toBe(true)
            expect(v.isEmpty).toBe(false)
        })
    })

})

