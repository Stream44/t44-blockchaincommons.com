

import { join, dirname } from 'path'
import { mkdir, writeFile, readFile, rm, access } from 'fs/promises'
import { tmpdir } from 'os'

type AllowedSigner = { email: string; publicKey: string }

async function withAllowedSigners<T>(signers: AllowedSigner[], fn: (gitArgs: string[]) => Promise<T>): Promise<T> {
    const lines = signers.map(s => `${s.email} namespaces="git" ${s.publicKey}`)
    const tmpFile = join(tmpdir(), `oi-allowed-signers-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await writeFile(tmpFile, lines.join('\n') + '\n')
    try {
        return await fn(['-c', `gpg.ssh.allowedSignersFile=${tmpFile}`])
    } finally {
        await rm(tmpFile, { force: true })
    }
}


async function exec(cmd: string[], options: { cwd: string; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const proc = Bun.spawn(cmd, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdout: 'pipe',
        stderr: 'pipe',
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

async function git(args: string[], options: { cwd: string; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return exec(['git', ...args], options)
}

async function sshKeygen(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return exec(['ssh-keygen', ...args], { cwd: '/tmp' })
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

                readSigningKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        privateKeyPath: string
                    }) {
                        const keyPath = context.privateKeyPath
                        const publicKey = (await readFile(`${keyPath}.pub`, 'utf-8')).trim()

                        const fpResult = await sshKeygen(['-E', 'sha256', '-lf', keyPath])
                        if (fpResult.exitCode !== 0) {
                            throw new Error(`ssh-keygen fingerprint failed: ${fpResult.stderr}`)
                        }
                        const fingerprint = fpResult.stdout.split(' ')[1] || ''

                        return {
                            privateKeyPath: keyPath,
                            publicKeyPath: `${keyPath}.pub`,
                            publicKey,
                            fingerprint,
                        }
                    }
                },

                generateSigningKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        keyDir: string
                        keyName?: string
                        passphrase?: string
                    }) {
                        const keyName = context.keyName || 'sign_id_ed25519'
                        const keyPath = join(context.keyDir, keyName)
                        const passphrase = context.passphrase || ''

                        await mkdir(context.keyDir, { recursive: true })

                        const result = await sshKeygen([
                            '-t', 'ed25519',
                            '-f', keyPath,
                            '-N', passphrase,
                            '-C', keyName,
                        ])

                        if (result.exitCode !== 0) {
                            throw new Error(`ssh-keygen failed: ${result.stderr}`)
                        }

                        const publicKey = await readFile(`${keyPath}.pub`, 'utf-8')

                        // Get fingerprint
                        const fpResult = await sshKeygen(['-E', 'sha256', '-lf', keyPath])
                        const fingerprint = fpResult.stdout.split(' ')[1] || ''

                        return {
                            privateKeyPath: keyPath,
                            publicKeyPath: `${keyPath}.pub`,
                            publicKey: publicKey.trim(),
                            fingerprint,
                        }
                    }
                },

                createInceptionCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        signingKeyPath: string
                        authorName: string
                        authorEmail: string
                        message?: string
                        contract?: string
                    }) {
                        // Init repo
                        await mkdir(context.repoDir, { recursive: true })
                        const initResult = await git(['init'], { cwd: context.repoDir })
                        if (initResult.exitCode !== 0) {
                            throw new Error(`git init failed: ${initResult.stderr}`)
                        }

                        // Get key fingerprint for committer name
                        const fpResult = await sshKeygen(['-E', 'sha256', '-lf', context.signingKeyPath])
                        if (fpResult.exitCode !== 0) {
                            throw new Error(`ssh-keygen fingerprint failed: ${fpResult.stderr}`)
                        }
                        const fingerprint = fpResult.stdout.split(' ')[1] || ''

                        const dateStr = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

                        const env: Record<string, string> = {
                            GIT_AUTHOR_NAME: context.authorName,
                            GIT_AUTHOR_EMAIL: context.authorEmail,
                            GIT_COMMITTER_NAME: fingerprint,
                            GIT_COMMITTER_EMAIL: context.authorEmail,
                            GIT_AUTHOR_DATE: dateStr,
                            GIT_COMMITTER_DATE: dateStr,
                        }

                        const inceptionMessage = context.message || '[GordianOpenIntegrity] Establish a SHA-1 root of trust for origin and future commit verification.'
                        const ricardianContract = context.contract || 'Trust established using https://github.com/Stream44/t44-BlockchainCommons.com'

                        const commitResult = await git([
                            '-c', 'gpg.format=ssh',
                            '-c', `user.signingkey=${context.signingKeyPath}`,
                            'commit',
                            '--allow-empty',
                            '--no-edit',
                            '--gpg-sign',
                            '-m', inceptionMessage,
                            '-m', `Signed-off-by: ${context.authorName} <${context.authorEmail}>`,
                            '-m', ricardianContract,
                        ], { cwd: context.repoDir, env })

                        if (commitResult.exitCode !== 0) {
                            throw new Error(`Inception commit failed: ${commitResult.stderr}`)
                        }

                        // Get the commit hash
                        const hashResult = await git(['rev-list', '--max-parents=0', 'HEAD'], { cwd: context.repoDir })
                        const commitHash = hashResult.stdout.trim()

                        return {
                            commitHash,
                            did: `did:repo:${commitHash}`,
                            fingerprint,
                            message: inceptionMessage,
                        }
                    }
                },

                getRepoDid: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { repoDir: string }) {
                        const hashResult = await git(['rev-list', '--max-parents=0', 'HEAD'], { cwd: context.repoDir })
                        if (hashResult.exitCode !== 0) {
                            throw new Error(`Failed to get first commit: ${hashResult.stderr}`)
                        }
                        const commitHash = hashResult.stdout.split('\n')[0].trim()
                        return `did:repo:${commitHash}`
                    }
                },

                getInceptionCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { repoDir: string }) {
                        const hashResult = await git(['rev-list', '--max-parents=0', 'HEAD'], { cwd: context.repoDir })
                        if (hashResult.exitCode !== 0) {
                            throw new Error(`Failed to get inception commit: ${hashResult.stderr}`)
                        }
                        const commitHash = hashResult.stdout.split('\n')[0].trim()

                        // Get full details
                        const showResult = await git(['show', '--pretty=fuller', commitHash], { cwd: context.repoDir })

                        // Get committer details
                        const committerResult = await git(['log', '--format=%cn <%ce>', '-1', commitHash], { cwd: context.repoDir })

                        // Get key fingerprint
                        const keyResult = await git(['log', '--format=%GK', '-1', commitHash], { cwd: context.repoDir })

                        // Get signature status
                        const sigStatusResult = await git(['log', '--format=%G?', '-1', commitHash], { cwd: context.repoDir })

                        return {
                            commitHash,
                            did: `did:repo:${commitHash}`,
                            fullDetails: showResult.stdout,
                            committer: committerResult.stdout.trim(),
                            keyFingerprint: keyResult.stdout.trim(),
                            signatureStatus: sigStatusResult.stdout.trim(),
                        }
                    }
                },

                verifyInceptionCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        allowedSigners: AllowedSigner[]
                    }) {
                        const hashResult = await git(['rev-list', '--max-parents=0', 'HEAD'], { cwd: context.repoDir })
                        if (hashResult.exitCode !== 0) {
                            throw new Error(`Failed to get inception commit: ${hashResult.stderr}`)
                        }
                        const commitHash = hashResult.stdout.split('\n')[0].trim()

                        return withAllowedSigners(context.allowedSigners, async (cfg) => {
                            const verifyResult = await git([...cfg, 'verify-commit', commitHash], { cwd: context.repoDir })
                            const output = verifyResult.stderr || verifyResult.stdout
                            const isGood = output.includes('Good "git" signature')

                            const verboseResult = await git([...cfg, 'verify-commit', '-v', commitHash], { cwd: context.repoDir })

                            return {
                                commitHash,
                                valid: isGood,
                                exitCode: verifyResult.exitCode,
                                output,
                                verboseOutput: verboseResult.stderr || verboseResult.stdout,
                            }
                        })
                    }
                },

                verifyCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        commitHash?: string
                        allowedSigners: AllowedSigner[]
                    }) {
                        const hash = context.commitHash || 'HEAD'

                        return withAllowedSigners(context.allowedSigners, async (cfg) => {
                            const verifyResult = await git([...cfg, 'verify-commit', hash], { cwd: context.repoDir })
                            const output = verifyResult.stderr || verifyResult.stdout
                            const isGood = output.includes('Good "git" signature')

                            const sigStatusResult = await git(['log', '--format=%G?|%GK|%GS', '-1', hash], { cwd: context.repoDir })
                            const [status, keyFingerprint, signer] = sigStatusResult.stdout.split('|')

                            return {
                                commitHash: hash,
                                valid: isGood,
                                exitCode: verifyResult.exitCode,
                                output,
                                signatureStatus: status,
                                keyFingerprint,
                                signer,
                            }
                        })
                    }
                },

                listCommits: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        reverse?: boolean
                    }) {
                        const args = ['log', '--oneline', '--format=%H|%s|%G?|%GK']
                        if (context.reverse) {
                            args.push('--reverse')
                        }

                        const result = await git(args, { cwd: context.repoDir })
                        if (result.exitCode !== 0) {
                            throw new Error(`Failed to list commits: ${result.stderr}`)
                        }

                        const commits = result.stdout.split('\n')
                            .filter(l => l.trim() !== '')
                            .map(line => {
                                const [hash, message, sigStatus, keyFingerprint] = line.split('|')
                                return { hash, message, signatureStatus: sigStatus, keyFingerprint }
                            })

                        return { commits, count: commits.length }
                    }
                },

                getCommitDetails: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        commitHash?: string
                    }) {
                        const hash = context.commitHash || 'HEAD'

                        const showResult = await git(['show', '--pretty=fuller', hash], { cwd: context.repoDir })
                        const formatResult = await git([
                            'log', '--format=%H|%an|%ae|%cn|%ce|%s|%G?|%GK', '-1', hash
                        ], { cwd: context.repoDir })

                        const parts = formatResult.stdout.split('|')
                        return {
                            commitHash: parts[0],
                            authorName: parts[1],
                            authorEmail: parts[2],
                            committerName: parts[3],
                            committerEmail: parts[4],
                            message: parts[5],
                            signatureStatus: parts[6],
                            keyFingerprint: parts[7],
                            fullDetails: showResult.stdout,
                        }
                    }
                },

                createSignedCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        signingKeyPath: string
                        message: string
                        authorName: string
                        authorEmail: string
                        files?: Array<{ path: string; content: string }>
                        allowEmpty?: boolean
                    }) {
                        // Write files and stage them
                        if (context.files && context.files.length > 0) {
                            for (const file of context.files) {
                                const absPath = join(context.repoDir, file.path)
                                await mkdir(dirname(absPath), { recursive: true })
                                await writeFile(absPath, file.content, 'utf-8')

                                const addResult = await git(['add', file.path], { cwd: context.repoDir })
                                if (addResult.exitCode !== 0) {
                                    throw new Error(`git add failed for ${file.path}: ${addResult.stderr}`)
                                }
                            }
                        }

                        const env: Record<string, string> = {
                            GIT_AUTHOR_NAME: context.authorName,
                            GIT_AUTHOR_EMAIL: context.authorEmail,
                            GIT_COMMITTER_NAME: context.authorName,
                            GIT_COMMITTER_EMAIL: context.authorEmail,
                        }

                        const args = [
                            '-c', 'gpg.format=ssh',
                            '-c', `user.signingkey=${context.signingKeyPath}`,
                            'commit',
                            '--gpg-sign',
                            '--signoff',
                            '-m', context.message,
                        ]

                        if (context.allowEmpty) {
                            args.push('--allow-empty')
                        }

                        const commitResult = await git(args, { cwd: context.repoDir, env })

                        if (commitResult.exitCode !== 0) {
                            throw new Error(`Signed commit failed: ${commitResult.stderr}`)
                        }

                        const hashResult = await git(['rev-parse', 'HEAD'], { cwd: context.repoDir })

                        return {
                            commitHash: hashResult.stdout.trim(),
                            message: context.message,
                        }
                    }
                },

                auditRepository: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        allowedSigners: AllowedSigner[]
                    }) {
                        return withAllowedSigners(context.allowedSigners, async (cfg) => {
                            const results: any[] = []

                            // Get all commits oldest first
                            const listResult = await git([
                                'log', '--oneline', '--format=%H|%s|%G?|%GK|%an|%cn', '--reverse'
                            ], { cwd: context.repoDir })

                            if (listResult.exitCode !== 0) {
                                throw new Error(`Failed to list commits: ${listResult.stderr}`)
                            }

                            const commits = listResult.stdout.split('\n').filter(l => l.trim() !== '')

                            // Check inception commit
                            const inceptionHash = commits[0]?.split('|')[0]
                            const inceptionVerify = await git([...cfg, 'verify-commit', inceptionHash], { cwd: context.repoDir })
                            const inceptionOutput = inceptionVerify.stderr || inceptionVerify.stdout
                            const inceptionValid = inceptionOutput.includes('Good "git" signature')

                            // Check if inception commit is empty (empty tree)
                            const treeResult = await git(['log', '--format=%T', '-1', inceptionHash], { cwd: context.repoDir })
                            const isEmptyTree = treeResult.stdout.trim() === '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

                            for (const line of commits) {
                                const [hash, message, sigStatus, keyFingerprint, authorName, committerName] = line.split('|')
                                const verifyResult = await git([...cfg, 'verify-commit', hash], { cwd: context.repoDir })
                                const verifyOutput = verifyResult.stderr || verifyResult.stdout
                                const valid = verifyOutput.includes('Good "git" signature')

                                results.push({
                                    hash,
                                    message,
                                    signatureStatus: sigStatus,
                                    keyFingerprint,
                                    authorName,
                                    committerName,
                                    signatureValid: valid,
                                    verifyOutput,
                                })
                            }

                            return {
                                totalCommits: results.length,
                                validSignatures: results.filter(r => r.signatureValid).length,
                                invalidSignatures: results.filter(r => !r.signatureValid).length,
                                inceptionCommitValid: inceptionValid,
                                inceptionCommitEmpty: isEmptyTree,
                                did: `did:repo:${inceptionHash}`,
                                commits: results,
                            }
                        })
                    }
                },

                exec: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        args: string[]
                        cwd: string
                    }) {
                        return git(context.args, { cwd: context.cwd })
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
capsule['#'] = 't44/caps/providers/blockchaincommons.com/open-integrity-js'
