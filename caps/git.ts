


// ── Constants ────────────────────────────────────────────────────────

const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'


// ── Capsule ──────────────────────────────────────────────────────────

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

                // ── Mapped dependencies ──────────────────────────────

                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/fs'
                },

                exec: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        cmd: string[]
                        cwd: string
                        env?: Record<string, string>
                    }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
                        const proc = Bun.spawn(context.cmd, {
                            cwd: context.cwd,
                            env: { ...process.env, ...context.env },
                            stdout: 'pipe',
                            stderr: 'pipe',
                        })
                        const stdout = await new Response(proc.stdout).text()
                        const stderr = await new Response(proc.stderr).text()
                        const exitCode = await proc.exited
                        return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
                    }
                },

                run: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        args: string[]
                        cwd: string
                        env?: Record<string, string>
                    }) {
                        return this.exec({ cmd: ['git', ...context.args], cwd: context.cwd, env: context.env })
                    }
                },

                ensureRepo: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { repoDir: string }) {
                        await this.fs.mkdir({ path: context.repoDir })
                        const gitDir = await this.fs.join({ parts: [context.repoDir, '.git'] })
                        const hasGit = await this.fs.exists({ path: gitDir })
                        if (!hasGit) {
                            const result = await this.run({ args: ['init'], cwd: context.repoDir })
                            if (result.exitCode !== 0) {
                                throw new Error(`git init failed: ${result.stderr}`)
                            }
                        }
                    }
                },

                initRepo: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        signingKeyPath: string
                        authorName: string
                        authorEmail: string
                        message?: string
                    }) {
                        await this.ensureRepo({ repoDir: context.repoDir })
                        return this.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: context.signingKeyPath,
                            message: context.message || 'Initial commit',
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                            allowEmpty: true,
                        })
                    }
                },

                addSignedCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        signingKeyPath: string
                        authorName: string
                        authorEmail: string
                        message: string
                        files?: Array<{ path: string; content: string }>
                    }) {
                        return this.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: context.signingKeyPath,
                            message: context.message,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                            files: context.files,
                            allowEmpty: !context.files || context.files.length === 0,
                        })
                    }
                },

                addUnsignedCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        authorName: string
                        authorEmail: string
                        message: string
                    }) {
                        const env: Record<string, string> = {
                            GIT_AUTHOR_NAME: context.authorName,
                            GIT_AUTHOR_EMAIL: context.authorEmail,
                            GIT_COMMITTER_NAME: context.authorName,
                            GIT_COMMITTER_EMAIL: context.authorEmail,
                        }
                        const result = await this.run({
                            args: ['commit', '--allow-empty', '-m', context.message],
                            cwd: context.repoDir,
                            env,
                        })
                        if (result.exitCode !== 0) {
                            throw new Error(`Unsigned commit failed: ${result.stderr}`)
                        }
                        const hashResult = await this.run({ args: ['rev-parse', 'HEAD'], cwd: context.repoDir })
                        return { commitHash: hashResult.stdout.trim(), message: context.message }
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
                        if (context.files && context.files.length > 0) {
                            for (const file of context.files) {
                                const absPath = await this.fs.join({ parts: [context.repoDir, file.path] })
                                const dirPath = await this.fs.dirname({ path: absPath })
                                await this.fs.mkdir({ path: dirPath })
                                await this.fs.writeFile({ path: absPath, content: file.content })
                                const addResult = await this.run({ args: ['add', file.path], cwd: context.repoDir })
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
                            'commit', '--gpg-sign', '--signoff',
                            '-m', context.message,
                        ]
                        if (context.allowEmpty) {
                            args.push('--allow-empty')
                        }
                        const commitResult = await this.run({ args, cwd: context.repoDir, env })
                        if (commitResult.exitCode !== 0) {
                            throw new Error(`Signed commit failed: ${commitResult.stderr}`)
                        }
                        const hashResult = await this.run({ args: ['rev-parse', 'HEAD'], cwd: context.repoDir })
                        return { commitHash: hashResult.stdout.trim(), message: context.message }
                    }
                },

                listCommits: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { repoDir: string }) {
                        const result = await this.run({
                            args: ['log', '--format=%H|%an|%ae|%cn|%ce|%GK|%s', '--reverse'],
                            cwd: context.repoDir,
                        })
                        if (result.exitCode !== 0 || result.stdout.trim() === '') {
                            return []
                        }
                        return result.stdout.split('\n').filter((l: string) => l.trim() !== '').map((line: string) => {
                            const [hash, authorName, authorEmail, committerName, committerEmail, keyFingerprint, ...messageParts] = line.split('|')
                            return { hash, authorName, authorEmail, committerName, committerEmail, keyFingerprint, message: messageParts.join('|') }
                        })
                    }
                },

                auditSignatures: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        allowedSigners: Array<{ email: string; publicKey: string }>
                    }) {
                        const lines = context.allowedSigners.map((s: any) => `${s.email} namespaces="git" ${s.publicKey}`)
                        const tmpBase = await this.fs.tmpdir()
                        const tmpFile = await this.fs.join({ parts: [tmpBase, `integrity-allowed-signers-${Date.now()}-${Math.random().toString(36).slice(2)}`] })
                        await this.fs.writeFile({ path: tmpFile, content: lines.join('\n') + '\n' })

                        try {
                            const listResult = await this.run({
                                args: ['log', '--format=%H|%s|%G?|%GK|%an|%ae|%cn', '--reverse'],
                                cwd: context.repoDir,
                            })
                            if (listResult.exitCode !== 0) {
                                throw new Error(`Failed to list commits: ${listResult.stderr}`)
                            }

                            const commitLines = listResult.stdout.split('\n').filter((l: string) => l.trim() !== '')
                            const cfg = ['-c', `gpg.ssh.allowedSignersFile=${tmpFile}`]
                            const results: any[] = []

                            for (const line of commitLines) {
                                const [hash, message, sigStatus, keyFingerprint, authorName, authorEmail, committerName] = line.split('|')
                                const verifyResult = await this.run({ args: [...cfg, 'verify-commit', hash], cwd: context.repoDir })
                                const verifyOutput = verifyResult.stderr || verifyResult.stdout
                                const valid = verifyResult.exitCode === 0 && verifyOutput.includes('Good "git" signature')
                                results.push({ hash, message, signatureStatus: sigStatus, keyFingerprint, authorName, authorEmail, committerName, signatureValid: valid, verifyOutput })
                            }

                            const inceptionHash = commitLines[0]?.split('|')[0]
                            const treeResult = await this.run({ args: ['log', '--format=%T', '-1', inceptionHash], cwd: context.repoDir })
                            const isEmptyTree = treeResult.stdout.trim() === EMPTY_TREE_HASH

                            return {
                                totalCommits: results.length,
                                validSignatures: results.filter((r: any) => r.signatureValid).length,
                                invalidSignatures: results.filter((r: any) => !r.signatureValid).length,
                                inceptionCommitValid: results[0]?.signatureValid || false,
                                inceptionCommitEmpty: isEmptyTree,
                                did: `did:repo:${inceptionHash}`,
                                commits: results,
                            }
                        } finally {
                            await this.fs.rm({ path: tmpFile, force: true })
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
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/git'
