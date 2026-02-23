
import { join } from 'path'
import { mkdir, access, readFile, writeFile, copyFile, rm, cp } from 'fs/promises'
import { constants } from 'fs'
import { $ } from 'bun'
import chalk from 'chalk'

const OI_REGISTRY_CAPSULE = '@t44.sh~t44~caps~patterns~blockchaincommons.com~GordianOpenIntegrity'
const GENERATOR_FILE = '.git/o/GordianOpenIntegrity-generator.yaml'

async function copyFilesToSourceDirs({ files, sourceDir, targetDirs }: {
    files: string[]
    sourceDir: string
    targetDirs: (string | undefined | null)[]
}) {
    for (const targetDir of targetDirs) {
        if (!targetDir) continue
        for (const file of files) {
            const srcPath = join(sourceDir, file)
            const destPath = join(targetDir, file)
            try {
                await access(srcPath, constants.F_OK)
                await mkdir(join(destPath, '..'), { recursive: true })
                await copyFile(srcPath, destPath)
            } catch { }
        }
    }
}

async function fileExistsInGitHistory(stageDir: string, filePath: string): Promise<boolean> {
    const result = await $`git log --all --format=%H -1 -- ${filePath}`.cwd(stageDir).quiet().nothrow()
    return result.exitCode === 0 && result.text().trim().length > 0
}

async function fileExistsInWorkingTree(dir: string, filePath: string): Promise<boolean> {
    try {
        await access(join(dir, filePath), constants.F_OK)
        return true
    } catch {
        return false
    }
}

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
                tags: {
                    type: CapsulePropertyTypes.Constant,
                    value: ['git'],
                },
                GordianOpenIntegrity: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/GordianOpenIntegrity'
                },
                HomeRegistry: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/HomeRegistry'
                },
                SigningKey: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/SigningKey'
                },
                WorkspacePrompt: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/WorkspacePrompt'
                },
                ProjectRepository: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/ProjectRepository'
                },
                ProjectCatalogs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/ProjectCatalogs'
                },
                prepare: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { config, ctx }: { config: any, ctx: any }) {
                        // Restore OI files that rsync --delete may have removed from the working tree.
                        // rsync syncs source → stage and deletes anything not in source. OI files like
                        // .repo-identifier and .o/* are committed in git but not in the source dir, so
                        // rsync removes them. We restore them here so all downstream code can rely on
                        // the working tree. This also copies them back to source dirs so future rsyncs
                        // preserve them.
                        const stageDir = ctx.metadata['t44/caps/patterns/git-scm.com/ProjectPublishing']?.stageDir
                        if (!stageDir) return

                        const oiEnabled = config.config?.GordianOpenIntegrity === true
                        if (!oiEnabled) return

                        const projectSourceDir = ctx.repoConfig.sourceDir

                        if (!ctx.options.dangerouslyResetMain) {
                            const hasRepoIdInHistory = await fileExistsInGitHistory(stageDir, '.repo-identifier')
                            const hasRepoIdInTree = await fileExistsInWorkingTree(stageDir, '.repo-identifier')

                            if (hasRepoIdInHistory && !hasRepoIdInTree) {
                                await $`git checkout HEAD -- .repo-identifier`.cwd(stageDir).quiet().nothrow()
                            }

                            const hasOiYamlInHistory = await fileExistsInGitHistory(stageDir, '.o/GordianOpenIntegrity.yaml')
                            const hasOiYamlInTree = await fileExistsInWorkingTree(stageDir, '.o/GordianOpenIntegrity.yaml')

                            if (hasOiYamlInHistory && !hasOiYamlInTree) {
                                const oiFiles = await this.GordianOpenIntegrity.getTrackedFiles()
                                for (const file of oiFiles) {
                                    await $`git checkout HEAD -- ${file}`.cwd(stageDir).quiet().nothrow()
                                }
                            }

                            if (hasRepoIdInHistory || hasOiYamlInHistory) {
                                const oiFiles = await this.GordianOpenIntegrity.getTrackedFiles()
                                await copyFilesToSourceDirs({
                                    files: oiFiles,
                                    sourceDir: stageDir,
                                    targetDirs: [ctx.repoSourceDir, projectSourceDir],
                                })
                            }
                        }

                        // Store OI enabled state in metadata for later steps
                        ctx.metadata[capsule['#']] = { oiEnabled, stageDir }
                    }
                },
                push: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { config, ctx }: { config: any, ctx: any }) {
                        const myMeta = ctx.metadata[capsule['#']]
                        if (!myMeta?.oiEnabled) return

                        const self = this
                        const stageDir = myMeta.stageDir
                        const projectSourceDir = ctx.repoConfig.sourceDir
                        const targetDirs = [ctx.repoSourceDir, projectSourceDir]
                        const { dangerouslyResetMain, dangerouslyResetGordianOpenIntegrity } = ctx.options

                        // ── Local helpers (closures over self) ──────────────

                        const loadKeys = async () => {
                            const authorConfig = ctx.metadata['t44/caps/patterns/git-scm.com/ProjectPublishing']?.authorConfig
                            if (!authorConfig?.name || !authorConfig?.email) {
                                throw new Error('GordianOpenIntegrity requires author.name and author.email in RepositorySettings config')
                            }
                            const signingKeyPath = await self.SigningKey.getKeyPath()
                            const signingPublicKey = await self.SigningKey.getPublicKey()
                            const signingFingerprint = await self.SigningKey.getFingerprint()
                            const signingKeyName = await self.SigningKey.getKeyName()
                            if (!signingKeyPath || !signingPublicKey || !signingFingerprint) {
                                throw new Error('Signing key not configured. Run SigningKey.ensureKey() first.')
                            }
                            console.log(chalk.gray(`  Signing key: ${signingKeyName} (${signingKeyPath})`))
                            console.log(chalk.gray(`  Author: ${authorConfig.name} <${authorConfig.email}>`))
                            return { authorName: authorConfig.name, authorEmail: authorConfig.email, signingKeyPath, signingPublicKey, signingFingerprint, signingKeyName }
                        }

                        const copyOiAndUpdateDid = async (dirs: (string | undefined | null)[], did: string) => {
                            const oiFiles = await self.GordianOpenIntegrity.getTrackedFiles()
                            await copyFilesToSourceDirs({ files: oiFiles, sourceDir: stageDir, targetDirs: dirs })
                            console.log(chalk.green(`  ✓ Copied OI files to source directories`))
                            const DID_PATTERN = /^(Repository DID: `)([^`]*)(`)$/m
                            for (const dir of dirs.filter(Boolean)) {
                                const readmePath = join(dir!, 'README.md')
                                try {
                                    const content = await readFile(readmePath, 'utf-8')
                                    if (DID_PATTERN.test(content)) {
                                        await writeFile(readmePath, content.replace(DID_PATTERN, `$1${did}$3`), 'utf-8')
                                        console.log(chalk.green(`  ✓ Updated Repository DID in ${readmePath}`))
                                    }
                                } catch { }
                            }
                        }

                        const storeGenerator = async (did: string) => {
                            const registryRootDir = await self.HomeRegistry.rootDir
                            const oiRegistryDir = join(registryRootDir, OI_REGISTRY_CAPSULE, did)
                            await mkdir(oiRegistryDir, { recursive: true })
                            const repoGeneratorPath = join(stageDir, GENERATOR_FILE)
                            const registryGeneratorPath = join(oiRegistryDir, 'GordianOpenIntegrity-generator.yaml')
                            await cp(repoGeneratorPath, registryGeneratorPath)
                            console.log(chalk.green(`  ✓ Generator stored at: ${registryGeneratorPath}`))
                            return oiRegistryDir
                        }

                        const storeRepoMeta = async (oiRegistryDir: string, did: string, commitHash: string, originUri?: string) => {
                            const repoMeta: Record<string, any> = { did, firstCommit: commitHash, firstCommitDate: new Date().toISOString(), origin: originUri }
                            try {
                                const pkg = JSON.parse(await readFile(join(ctx.repoSourceDir, 'package.json'), 'utf-8'))
                                if (pkg.name) repoMeta.packageName = pkg.name
                            } catch { }
                            await writeFile(join(oiRegistryDir, 'repo.json'), JSON.stringify(repoMeta, null, 2), 'utf-8')
                            console.log(chalk.green(`  ✓ Registry metadata stored at: ${join(oiRegistryDir, 'repo.json')}`))
                        }

                        const createOiRepo = async (keys: any) => {
                            return self.GordianOpenIntegrity.createRepository({
                                repoDir: stageDir,
                                authorName: keys.authorName,
                                authorEmail: keys.authorEmail,
                                firstTrustKeyPath: keys.signingKeyPath,
                                provenanceKeyPath: keys.signingKeyPath,
                            })
                        }

                        // ── dangerouslyResetMain with OI: create fresh OI repo ──
                        if (dangerouslyResetMain) {
                            const keys = await loadKeys()
                            const originUri = ctx.metadata['t44/caps/patterns/git-scm.com/ProjectPublishing']?.originUri

                            // Delete existing OI registry data for the previous repo DID
                            const registryRootDir_ = await self.HomeRegistry.rootDir
                            try {
                                const existingOiYaml = await readFile(join(stageDir, '.o', 'GordianOpenIntegrity.yaml'), 'utf-8')
                                const existingDidMatch = existingOiYaml.match(/^#\s*Repository DID:\s*(.+)$/m)
                                if (existingDidMatch) {
                                    const existingDid = existingDidMatch[1].trim()
                                    const existingOiRegistryDir = join(registryRootDir_, OI_REGISTRY_CAPSULE, existingDid)
                                    try {
                                        await access(existingOiRegistryDir, constants.F_OK)
                                        console.log(`Removing existing OI registry for ${existingDid} ...`)
                                        await rm(existingOiRegistryDir, { recursive: true, force: true })
                                    } catch { }
                                }
                            } catch { }

                            // Delete existing stage dir to start completely fresh
                            console.log(`Removing existing stage directory ...`)
                            await rm(stageDir, { recursive: true, force: true })

                            // Remove stale DCO signatures from source dirs (fresh repo = fresh DCO)
                            for (const dir of targetDirs.filter(Boolean)) {
                                await rm(join(dir!, '.dco-signatures'), { force: true })
                            }

                            // Create OI inception repo
                            console.log(`Creating GordianOpenIntegrity inception repository ...`)
                            const repoResult = await createOiRepo(keys)
                            console.log(chalk.green(`  ✓ Inception commit: ${repoResult.commitHash.slice(0, 8)}`))
                            console.log(chalk.green(`  ✓ DID: ${repoResult.did}`))

                            // Set local git author on the fresh repo
                            await $`git config user.name ${keys.authorName}`.cwd(stageDir).quiet()
                            await $`git config user.email ${keys.authorEmail}`.cwd(stageDir).quiet()

                            // Store registry data
                            console.log(chalk.green(`  ✓ Using workspace signing key: ${keys.signingKeyName} (${keys.signingFingerprint})`))
                            console.log(chalk.green(`    ${keys.signingKeyPath}`))
                            const oiRegistryDir = await storeGenerator(repoResult.did)
                            await storeRepoMeta(oiRegistryDir, repoResult.did, repoResult.commitHash, originUri)

                            await copyOiAndUpdateDid(targetDirs, repoResult.did)

                            // Sync source files into the OI repo
                            console.log(`Syncing source files ...`)
                            const gitignorePath = join(ctx.repoSourceDir, '.gitignore')
                            await self.ProjectRepository.sync({
                                rootDir: stageDir,
                                sourceDir: ctx.repoSourceDir,
                                gitignorePath,
                                excludePatterns: ctx.alwaysIgnore || []
                            })

                            // Generate files from config properties starting with '/'
                            const gitProviderConfig = ctx.metadata['t44/caps/patterns/git-scm.com/ProjectPublishing']?.providerConfig
                            if (gitProviderConfig?.config) {
                                for (const [key, value] of Object.entries(gitProviderConfig.config)) {
                                    if (key.startsWith('/')) {
                                        const targetPath = join(stageDir, key)
                                        const targetDir = join(targetPath, '..')
                                        await mkdir(targetDir, { recursive: true })
                                        const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
                                        await writeFile(targetPath, content, 'utf-8')
                                    }
                                }
                            }

                            // Stage all files and commit as a signed commit
                            console.log(`Committing source content as signed commit ...`)
                            await $`git add -A`.cwd(stageDir).quiet()
                            await self.GordianOpenIntegrity.commitToRepository({
                                repoDir: stageDir,
                                authorName: keys.authorName,
                                authorEmail: keys.authorEmail,
                                signingKeyPath: keys.signingKeyPath,
                                message: 'Published using @Stream44 Studio',
                            })
                            console.log(chalk.green(`  ✓ Source content committed`))

                            // Add remote origin and force push
                            const hasRemote = await self.ProjectRepository.hasRemote({ rootDir: stageDir, name: 'origin' })
                            if (!hasRemote) {
                                await self.ProjectRepository.addRemote({ rootDir: stageDir, name: 'origin', url: originUri })
                            }

                            console.log(`Force pushing to remote ...`)
                            await $`git push --force -u origin main --tags`.cwd(stageDir)
                            console.log(chalk.green(`  ✓ Force pushed to remote`))

                            myMeta.handledResetPush = true
                            return
                        } else
                            // ── dangerouslyResetGordianOpenIntegrity: reset trust root only ──
                            if (dangerouslyResetGordianOpenIntegrity) {
                                console.log(chalk.cyan(`\nResetting Gordian Open Integrity trust root ...`))
                                const keys = await loadKeys()

                                const repoIdentifierExists = await fileExistsInWorkingTree(stageDir, '.repo-identifier')

                                let repoResult: any
                                if (repoIdentifierExists) {
                                    console.log(chalk.gray(`  Found existing .repo-identifier — resetting trust root only`))
                                    repoResult = await self.GordianOpenIntegrity.createTrustRoot({
                                        repoDir: stageDir,
                                        authorName: keys.authorName,
                                        authorEmail: keys.authorEmail,
                                        firstTrustKeyPath: keys.signingKeyPath,
                                        provenanceKeyPath: keys.signingKeyPath,
                                    })
                                } else {
                                    console.log(chalk.gray(`  No .repo-identifier found — creating repository identifier and trust root`))
                                    repoResult = await createOiRepo(keys)
                                }
                                console.log(chalk.green(`  ✓ New trust root created`))
                                console.log(chalk.green(`  ✓ DID: ${repoResult.did}`))

                                await copyOiAndUpdateDid([stageDir, ...targetDirs], repoResult.did)
                                await storeGenerator(repoResult.did)

                                return
                            }

                        // ── Auto-initialize OI if enabled but not yet set up ──
                        const repoIdentifierExists = await fileExistsInWorkingTree(stageDir, '.repo-identifier')

                        if (!repoIdentifierExists) {
                            console.log(chalk.cyan(`\nInitializing Gordian Open Integrity (first time setup) ...`))
                            const keys = await loadKeys()
                            const originUri = ctx.metadata['t44/caps/patterns/git-scm.com/ProjectPublishing']?.originUri

                            const repoResult = await createOiRepo(keys)
                            console.log(chalk.green(`  ✓ GordianOpenIntegrity initialized`))
                            console.log(chalk.green(`  ✓ DID: ${repoResult.did}`))

                            await copyOiAndUpdateDid([stageDir, ...targetDirs], repoResult.did)
                            const oiRegistryDir = await storeGenerator(repoResult.did)
                            await storeRepoMeta(oiRegistryDir, repoResult.did, repoResult.commitHash, originUri)

                            // Re-stage all files since OI added new files
                            await self.ProjectRepository.addAll({ rootDir: stageDir })

                            myMeta.freshlyInitialized = true
                        }

                        // Copy OI tracked files back to source directories so rsync preserves them
                        const oiFiles = await self.GordianOpenIntegrity.getTrackedFiles()
                        await copyFilesToSourceDirs({
                            files: oiFiles,
                            sourceDir: stageDir,
                            targetDirs,
                        })
                    }
                },
                afterPush: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, { config, ctx }: { config: any, ctx: any }) {
                        const oiEnabled = config.config?.GordianOpenIntegrity === true
                        if (!oiEnabled) return

                        const gitMeta = ctx.metadata['t44/caps/patterns/git-scm.com/ProjectPublishing']
                        if (!gitMeta?.stageDir) return

                        const oiYamlPath = join(gitMeta.stageDir, '.o', 'GordianOpenIntegrity.yaml')
                        try {
                            const oiContent = await readFile(oiYamlPath, 'utf-8')
                            const didMatch = oiContent.match(/^#\s*Repository DID:\s*(.+)$/m)
                            const currentMarkMatch = oiContent.match(/^#\s*Current Mark:\s*(\S+)/m)
                            const inceptionMarkMatch = oiContent.match(/^#\s*Inception Mark:\s*(\S+)/m)
                            if (didMatch) {
                                await this.ProjectCatalogs.updateCatalogRepository({
                                    repoName: ctx.repoName,
                                    providerKey: '#t44/caps/patterns/blockchaincommons.com/GordianOpenIntegrity',
                                    providerData: {
                                        did: didMatch[1].trim(),
                                        inceptionMark: inceptionMarkMatch?.[1] || undefined,
                                        currentMark: currentMarkMatch?.[1] || undefined,
                                    },
                                })
                            }
                        } catch { }
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
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/ProjectPublishing'
