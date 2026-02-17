
import { $ } from 'bun'
import { join, dirname, resolve } from 'path'
import { chmod, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'


function resolveCoreSrcDir(): string {
    const thisDir = dirname(fileURLToPath(import.meta.url))
    // Walk up from caps/providers/blockchaincommons.com/ to the package root
    const pkgRoot = resolve(thisDir, '..')
    return join(pkgRoot, 'node_modules', 'open-integrity-core', 'src')
}

const gitSigningDir = join(tmpdir(), '.open-integrity-sh-signing')
const gitSigningKeyPath = join(gitSigningDir, 'signing_key_ed25519')
const gitSigningConfigPath = join(gitSigningDir, 'gitconfig')
const gitAllowedSignersPath = join(gitSigningDir, 'allowed_signers')

async function ensureGitSigningConfig(): Promise<string> {
    if (existsSync(gitSigningConfigPath)) return gitSigningConfigPath
    await mkdir(gitSigningDir, { recursive: true })
    if (!existsSync(gitSigningKeyPath)) {
        const proc = Bun.spawn(['ssh-keygen', '-t', 'ed25519', '-f', gitSigningKeyPath, '-N', '', '-q'], {
            stdout: 'ignore', stderr: 'ignore',
        })
        await proc.exited
    }
    // Read the public key to add to allowed_signers
    const pubKey = (await Bun.file(gitSigningKeyPath + '.pub').text()).trim()
    await writeFile(gitAllowedSignersPath, `oi-sh@test.local ${pubKey}\n`)
    const gitconfig = [
        '[user]',
        '    name = Open Integrity SH',
        '    email = oi-sh@test.local',
        `    signingkey = ${gitSigningKeyPath}`,
        '[gpg]',
        '    format = ssh',
        '[gpg "ssh"]',
        `    allowedSignersFile = ${gitAllowedSignersPath}`,
        '[commit]',
        '    gpgsign = true',
        '[init]',
        '    defaultBranch = main',
    ].join('\n')
    await writeFile(gitSigningConfigPath, gitconfig)
    return gitSigningConfigPath
}

async function runScript(scriptPath: string, args: string[], options: { cwd: string; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    await chmod(scriptPath, 0o755).catch(() => { })
    const configPath = await ensureGitSigningConfig()
    const escaped = [scriptPath, ...args].map(a => $.escape(a)).join(' ')
    // Set GIT_CONFIG_GLOBAL so the scripts find the required signing config
    // Use bash instead of zsh for better CI compatibility (GitHub Actions Ubuntu runners)
    const env = { ...process.env, GIT_CONFIG_GLOBAL: configPath, ...options.env }
    const result = await $`/bin/bash ${{ raw: escaped }}`.cwd(options.cwd).env(env).nothrow().quiet()
    return {
        stdout: result.stdout.toString().trim(),
        stderr: result.stderr.toString().trim(),
        exitCode: result.exitCode,
    }
}

const srcDir = resolveCoreSrcDir()
const SETUP_SCRIPT = join(srcDir, 'setup_git_inception_repo.sh')
const GET_DID_SCRIPT = join(srcDir, 'get_repo_did.sh')
const AUDIT_SCRIPT = join(srcDir, 'audit_inception_commit-POC.sh')
const SNIPPET_SCRIPT = join(srcDir, 'snippet_template.sh')

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

                createInceptionRepo: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        force?: boolean
                    }) {
                        const args = ['--repo', context.repoDir]
                        if (context.force) {
                            args.push('--force')
                        }

                        const result = await runScript(SETUP_SCRIPT, args, { cwd: dirname(context.repoDir) })

                        if (result.exitCode !== 0) {
                            throw new Error(`setup_git_inception_repo.sh failed (exit ${result.exitCode}): ${result.stderr}`)
                        }

                        return {
                            exitCode: result.exitCode,
                            stdout: result.stdout,
                            stderr: result.stderr,
                        }
                    }
                },

                getRepoDid: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                    }) {
                        const result = await runScript(GET_DID_SCRIPT, ['-C', context.repoDir], { cwd: context.repoDir })

                        if (result.exitCode !== 0) {
                            throw new Error(`get_repo_did.sh failed (exit ${result.exitCode}): ${result.stderr}`)
                        }

                        return result.stdout.trim()
                    }
                },

                auditInceptionCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        verbose?: boolean
                        quiet?: boolean
                        noPrompt?: boolean
                        noColor?: boolean
                    }) {
                        const args = ['-C', context.repoDir]
                        if (context.verbose) args.push('--verbose')
                        if (context.quiet) args.push('--quiet')
                        if (context.noPrompt) args.push('--no-prompt')
                        if (context.noColor) args.push('--no-color')

                        const result = await runScript(AUDIT_SCRIPT, args, { cwd: context.repoDir })

                        return {
                            passed: result.exitCode === 0,
                            exitCode: result.exitCode,
                            stdout: result.stdout,
                            stderr: result.stderr,
                        }
                    }
                },

                showFileStatus: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        filePath: string
                        format?: 'default' | 'json' | 'yaml'
                    }) {
                        const args: string[] = []
                        if (context.format) {
                            args.push('--format', context.format)
                        }
                        args.push(context.filePath)

                        const result = await runScript(SNIPPET_SCRIPT, args, { cwd: dirname(context.filePath) })

                        if (result.exitCode !== 0) {
                            throw new Error(`snippet_template.sh failed (exit ${result.exitCode}): ${result.stderr}`)
                        }

                        return {
                            exitCode: result.exitCode,
                            stdout: result.stdout,
                            stderr: result.stderr,
                        }
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
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/open-integrity-sh'
