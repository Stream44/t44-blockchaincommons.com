

const IDENTIFIER_FILE = '.repo-identifier'
const IDENTIFIER_MESSAGE_PREFIX = '[RepositoryIdentifier]'
const DEFAULT_IDENTIFIER_MESSAGE = `${IDENTIFIER_MESSAGE_PREFIX} Establish signed repository identifier.`

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

                git: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/git'
                },
                key: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/key'
                },
                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/fs'
                },

                createIdentifier: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        signingKeyPath: string
                        authorName: string
                        authorEmail: string
                        message?: string
                    }) {
                        await this.git.ensureRepo({ repoDir: context.repoDir })

                        const fingerprint = await this.key.getFingerprint({ signingKeyPath: context.signingKeyPath })
                        const inceptionDate = new Date()
                        const dateStr = inceptionDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
                        const message = context.message || DEFAULT_IDENTIFIER_MESSAGE

                        // 1. Create the signed empty identifier commit with Signed-off-by trailer
                        const commitResult = await this.git.run({
                            args: [
                                '-c', 'gpg.format=ssh',
                                '-c', `user.signingkey=${context.signingKeyPath}`,
                                'commit',
                                '--allow-empty',
                                '--no-edit',
                                '--gpg-sign',
                                '-m', message,
                                '-m', `Signed-off-by: ${context.authorName} <${context.authorEmail}>`,
                            ],
                            cwd: context.repoDir,
                            env: {
                                GIT_AUTHOR_NAME: context.authorName,
                                GIT_AUTHOR_EMAIL: context.authorEmail,
                                GIT_COMMITTER_NAME: fingerprint,
                                GIT_COMMITTER_EMAIL: context.authorEmail,
                                GIT_AUTHOR_DATE: dateStr,
                                GIT_COMMITTER_DATE: dateStr,
                            }
                        })

                        if (commitResult.exitCode !== 0) {
                            throw new Error(`Identifier commit failed: ${commitResult.stderr}`)
                        }

                        const hashResult = await this.git.run({ args: ['rev-parse', 'HEAD'], cwd: context.repoDir })
                        const identifierCommitHash = hashResult.stdout.trim()
                        const did = `did:repo:${identifierCommitHash}`

                        // 2. Create .repo-identifier file and commit it with --signoff
                        const identifierPath = await this.fs.join({ parts: [context.repoDir, IDENTIFIER_FILE] })
                        await this.fs.writeFile({ path: identifierPath, content: `${did}\n` })

                        const addResult = await this.git.run({ args: ['add', IDENTIFIER_FILE], cwd: context.repoDir })
                        if (addResult.exitCode !== 0) {
                            throw new Error(`Failed to stage ${IDENTIFIER_FILE}: ${addResult.stderr}`)
                        }

                        const fileCommitResult = await this.git.run({
                            args: [
                                '-c', 'gpg.format=ssh',
                                '-c', `user.signingkey=${context.signingKeyPath}`,
                                'commit',
                                '--gpg-sign',
                                '--signoff',
                                '-m', `${IDENTIFIER_MESSAGE_PREFIX} Track ${identifierCommitHash.slice(0, 8)}`,
                            ],
                            cwd: context.repoDir,
                            env: {
                                GIT_AUTHOR_NAME: context.authorName,
                                GIT_AUTHOR_EMAIL: context.authorEmail,
                                GIT_COMMITTER_NAME: context.authorName,
                                GIT_COMMITTER_EMAIL: context.authorEmail,
                            }
                        })

                        if (fileCommitResult.exitCode !== 0) {
                            throw new Error(`Failed to commit ${IDENTIFIER_FILE}: ${fileCommitResult.stderr}`)
                        }

                        return {
                            commitHash: identifierCommitHash,
                            did,
                            fingerprint,
                            inceptionDate,
                        }
                    }
                },

                getIdentifier: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { repoDir: string }) {
                        // O(1) lookup: read the current .repo-identifier file
                        const filePath = await this.fs.join({ parts: [context.repoDir, IDENTIFIER_FILE] })
                        const content = (await this.fs.readFile({ path: filePath })).trim()

                        if (!content.startsWith('did:repo:')) {
                            throw new Error(`Invalid ${IDENTIFIER_FILE} content: ${content}`)
                        }

                        const commitHash = content.replace('did:repo:', '')
                        return { commitHash, did: content }
                    }
                },

                getIdentifiers: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { repoDir: string }) {
                        // Fast lookup via git log on the identifier file
                        const hashResult = await this.git.run({
                            args: ['log', '--format=%H', '--follow', '--', IDENTIFIER_FILE],
                            cwd: context.repoDir
                        })

                        if (hashResult.exitCode !== 0 || hashResult.stdout === '') {
                            return { identifiers: [], count: 0 }
                        }

                        const fileCommitHashes = hashResult.stdout.split('\n').filter((h: string) => h.trim() !== '')
                        const identifiers: { commitHash: string; did: string }[] = []

                        for (const fileCommitHash of fileCommitHashes) {
                            const showResult = await this.git.run({
                                args: ['show', `${fileCommitHash}:${IDENTIFIER_FILE}`],
                                cwd: context.repoDir
                            })

                            if (showResult.exitCode !== 0) continue

                            const did = showResult.stdout.trim()
                            if (!did.startsWith('did:repo:')) continue

                            const commitHash = did.replace('did:repo:', '')
                            identifiers.push({ commitHash, did })
                        }

                        return { identifiers, count: identifiers.length }
                    }
                },

                validateIdentifier: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        commitHash?: string
                    }) {
                        // Read identifier from file if no hash provided
                        let commitHash = context.commitHash
                        let fileCommitHash: string | undefined

                        if (!commitHash) {
                            // Find the file commit that tracks this identifier
                            const logResult = await this.git.run({
                                args: ['log', '--format=%H', '-1', '--', IDENTIFIER_FILE],
                                cwd: context.repoDir
                            })
                            fileCommitHash = logResult.stdout.trim()

                            const filePath = await this.fs.join({ parts: [context.repoDir, IDENTIFIER_FILE] })
                            const content = (await this.fs.readFile({ path: filePath })).trim()
                            if (!content.startsWith('did:repo:')) {
                                return { valid: false, error: `Invalid ${IDENTIFIER_FILE} content` }
                            }
                            commitHash = content.replace('did:repo:', '')
                        }

                        // Verify the identifier commit exists and get metadata
                        const metaResult = await this.git.run({
                            args: ['log', '--format=%H|%an|%ae', '-1', commitHash],
                            cwd: context.repoDir
                        })

                        if (metaResult.exitCode !== 0 || metaResult.stdout === '') {
                            return { valid: false, error: `Commit ${commitHash} not found` }
                        }

                        const [hash, authorName, authorEmail] = metaResult.stdout.split('|')

                        // Check for signature by inspecting the raw commit object
                        const catResult = await this.git.run({ args: ['cat-file', '-p', commitHash], cwd: context.repoDir })
                        const isSigned = catResult.stdout.includes('gpgsig ')

                        // Get signing key fingerprint from identifier commit's committer name
                        const idCommitterResult = await this.git.run({ args: ['log', '--format=%cn', '-1', commitHash], cwd: context.repoDir })
                        const idKeyFingerprint = idCommitterResult.stdout.trim()

                        // Check the commit is empty (no file changes)
                        const treeResult = await this.git.run({ args: ['log', '--format=%T', '-1', commitHash], cwd: context.repoDir })
                        const parentResult = await this.git.run({ args: ['log', '--format=%P', '-1', commitHash], cwd: context.repoDir })
                        const parentHash = parentResult.stdout.trim()

                        let isEmpty = false
                        if (!parentHash) {
                            // Root commit: check for empty tree
                            isEmpty = treeResult.stdout.trim() === '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
                        } else {
                            // Non-root: check tree matches parent tree (no file changes)
                            const parentTreeResult = await this.git.run({ args: ['log', '--format=%T', '-1', parentHash], cwd: context.repoDir })
                            isEmpty = treeResult.stdout.trim() === parentTreeResult.stdout.trim()
                        }

                        // Check author and signing key consistency between identifier commit and file commit
                        let authorMatch = true
                        let keyMatch = true
                        if (fileCommitHash) {
                            const fileMetaResult = await this.git.run({
                                args: ['log', '--format=%an|%ae', '-1', fileCommitHash],
                                cwd: context.repoDir
                            })
                            const [fileAuthorName, fileAuthorEmail] = fileMetaResult.stdout.split('|')
                            authorMatch = authorName === fileAuthorName && authorEmail === fileAuthorEmail

                            // Compare SSH signature public keys to verify same signing key
                            // Extract the public key line from both signatures (line 2 of the signature block)
                            const idSigMatch = catResult.stdout.match(/-----BEGIN SSH SIGNATURE-----\n ([^\n]+)/)
                            const fileCatResult = await this.git.run({ args: ['cat-file', '-p', fileCommitHash], cwd: context.repoDir })
                            const fileSigMatch = fileCatResult.stdout.match(/-----BEGIN SSH SIGNATURE-----\n ([^\n]+)/)

                            // The first line of SSH signature contains the public key - if they match, same key was used
                            keyMatch = !!(idSigMatch && fileSigMatch && idSigMatch[1] === fileSigMatch[1])
                        }

                        return {
                            valid: isSigned && isEmpty && authorMatch && keyMatch,
                            commitHash: hash,
                            did: `did:repo:${hash}`,
                            isSigned,
                            isEmpty,
                            authorMatch,
                            keyMatch,
                            keyFingerprint: idKeyFingerprint,
                            authorName,
                            authorEmail,
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
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/GitRepositoryIdentifier'
