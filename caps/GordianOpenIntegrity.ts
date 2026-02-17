

// ── Constants ────────────────────────────────────────────────────────

const PROVENANCE_FILE = '.o/GordianOpenIntegrity.yaml'
const GENERATOR_FILE = '.git/o/GordianOpenIntegrity-generator.yaml'
const ASSERTION_SIGNING_KEY = 'GordianOpenIntegrity.SigningKey'
const ASSERTION_REPO_ID = 'GordianOpenIntegrity.RepositoryIdentifier'
const ASSERTION_DOCUMENT = 'GordianOpenIntegrity.Document'
const ASSERTION_DOCUMENTS = 'GordianOpenIntegrity.Documents'
const CONTRACT = 'Trust established using https://github.com/Stream44/t44-BlockchainCommons.com'
const INCEPTION_LIFEHASH_FILE = '.o/GordianOpenIntegrity-InceptionLifehash.svg'
const CURRENT_LIFEHASH_FILE = '.o/GordianOpenIntegrity-CurrentLifehash.svg'


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

                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/fs'
                },
                git: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/git'
                },
                key: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/key'
                },
                xid: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/xid'
                },
                ledger: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/XidDocumentLedger'
                },
                repoId: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/GitRepositoryIdentifier'
                },
                integrity: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/GitRepositoryIntegrity'
                },
                provenanceMark: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/provenance-mark'
                },
                lifehash: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/lifehash'
                },

                // ══════════════════════════════════════════════════════
                // AUTHOR methods — require private key material
                // ══════════════════════════════════════════════════════

                createDocument: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        documentKeyPath: string
                        provenanceKeyPath: string
                        provenanceDate?: Date
                    }) {
                        const { PrivateKeyBase } = await this.xid.types()
                        const docKeyBase = await this.key.deriveKeyBase({ keyPath: context.documentKeyPath, PrivateKeyBase })
                        const seed = await this.key.deriveProvenanceSeed({ keyPath: context.provenanceKeyPath })

                        return this.xid.createDocument({
                            keyType: 'privateKeyBase',
                            privateKeyBase: docKeyBase,
                            provenance: {
                                type: 'seed',
                                seed,
                                date: context.provenanceDate || new Date(),
                            },
                        })
                    }
                },

                createTrustRoot: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        authorName: string
                        authorEmail: string
                        firstTrustKeyPath: string
                        provenanceKeyPath: string
                        contract?: string
                        existingIdentifier?: { commitHash: string; did: string; inceptionDate?: Date }
                    }) {
                        // Read SSH key from firstTrustKeyPath
                        const sshKey = await this.key.readSigningKey({ privateKeyPath: context.firstTrustKeyPath })
                        const provenanceSeed = await this.key.deriveProvenanceSeed({ keyPath: context.provenanceKeyPath })

                        const author: any = {
                            sshKey,
                            provenanceSeed,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                        }
                        const documentPath = await this.fs.join({ parts: [context.repoDir, PROVENANCE_FILE] })
                        const generatorPath = await this.fs.join({ parts: [context.repoDir, GENERATOR_FILE] })

                        // Use existing identifier or read from repo
                        const inception = context.existingIdentifier || await this.repoId.getIdentifier({ repoDir: context.repoDir })
                        const inceptionDate = inception.inceptionDate || new Date()

                        // 1. Create XID document using createDocument with inception date
                        author.document = await this.createDocument({
                            documentKeyPath: context.firstTrustKeyPath,
                            provenanceKeyPath: context.provenanceKeyPath,
                            provenanceDate: inceptionDate,
                        })

                        // 2. Create ledger — writes provenance.yaml and generator state
                        //    Include signing key and repository identifier as envelope assertions
                        //    Use provenanceSeed as encryptionKey to encrypt sensitive generator fields
                        const ledger = await this.ledger.createLedger({
                            document: author.document,
                            documentPath,
                            generatorPath,
                            encryptionKey: author.provenanceSeed,
                            assertions: [
                                { predicate: ASSERTION_SIGNING_KEY, object: author.sshKey.publicKey },
                                { predicate: ASSERTION_REPO_ID, object: inception!.did },
                            ],
                            contract: context.contract || CONTRACT,
                            repositoryDid: inception!.did,
                        })

                        // 3. Advance ledger for the SSH key link using inception commit date
                        author.ledger = await this.ledger.commit({
                            ledger,
                            document: author.document,
                            label: 'link-ssh-key',
                            date: inceptionDate,
                        })

                        // 4. Read the YAML that the ledger wrote and commit it
                        const provenanceContent = await this.fs.readFile({ path: documentPath })
                        await this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: author.sshKey.privateKeyPath,
                            message: `[GordianOpenIntegrity] Establish inception Gordian Envelope at: ${PROVENANCE_FILE}\n\n${context.contract || CONTRACT}`,
                            authorName: author.authorName,
                            authorEmail: author.authorEmail,
                            files: [{ path: PROVENANCE_FILE, content: provenanceContent }],
                        })

                        // 5. Generate lifehash images for the inception mark
                        const latest = await this.ledger.getLatest({ ledger: author.ledger })
                        await this._writeLifehashes({
                            repoDir: context.repoDir,
                            mark: latest.mark,
                            inception: true,
                        })

                        return {
                            did: inception!.did,
                            commitHash: inception!.commitHash,
                            mark: latest.mark,
                            author,
                        }
                    }
                },

                createRepository: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        authorName: string
                        authorEmail: string
                        firstTrustKeyPath: string
                        provenanceKeyPath: string
                        contract?: string
                        blockchainCommonsCompatibility?: boolean
                    }) {
                        // Read SSH key from firstTrustKeyPath
                        const sshKey = await this.key.readSigningKey({ privateKeyPath: context.firstTrustKeyPath })

                        // Determine inception commit message
                        const inceptionMessage = context.blockchainCommonsCompatibility
                            ? 'Initialize repository and establish a SHA-1 root of trust'
                            : undefined

                        // 1. Create repository identifier (inception commit + .repo-identifier)
                        const inception = await this.repoId.createIdentifier({
                            repoDir: context.repoDir,
                            signingKeyPath: sshKey.privateKeyPath,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                            message: inceptionMessage,
                        })

                        // 2. Delegate to createTrustRoot with the newly created identifier
                        return this.createTrustRoot({
                            repoDir: context.repoDir,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                            firstTrustKeyPath: context.firstTrustKeyPath,
                            provenanceKeyPath: context.provenanceKeyPath,
                            contract: context.contract,
                            existingIdentifier: inception,
                        })
                    }
                },

                rotateTrustSigningKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        authorName: string
                        authorEmail: string
                        existingSigningKeyPath: string
                        newSigningKeyPath: string
                        author: any
                    }) {
                        const { author } = context
                        const date = new Date()

                        // 1. Read the new SSH key
                        const newSshKey = await this.key.readSigningKey({ privateKeyPath: context.newSigningKeyPath })

                        // 2. Add new key to XID
                        const { PrivateKeyBase } = await this.xid.types()
                        const newKeyBase = await this.key.deriveKeyBase({ keyPath: context.newSigningKeyPath, PrivateKeyBase })
                        await this.xid.addKey({
                            document: author.document,
                            publicKeys: newKeyBase.ed25519PublicKeys(),
                            allowAll: true,
                        })

                        // Replace signing key assertion (only the current key should appear)
                        const existingAssertions = author.ledger.assertions || []
                        author.ledger.assertions = [
                            ...existingAssertions.filter((a: any) => a.predicate !== ASSERTION_SIGNING_KEY),
                            { predicate: ASSERTION_SIGNING_KEY, object: newSshKey.publicKey },
                        ]

                        // Record in ledger
                        author.ledger = await this.ledger.commit({
                            ledger: author.ledger,
                            document: author.document,
                            label: 'add-rotated-key',
                            date,
                        })

                        // 3. Remove old inception key
                        await this.xid.removeInceptionKey({ document: author.document })

                        author.ledger = await this.ledger.commit({
                            ledger: author.ledger,
                            document: author.document,
                            label: 'remove-inception-key',
                            date: new Date(),
                        })

                        // 4. Read the updated YAML and commit it (signed with OLD key, still valid)
                        const documentPath = await this.fs.join({ parts: [context.repoDir, PROVENANCE_FILE] })
                        const provenanceContent = await this.fs.readFile({ path: documentPath })

                        await this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: context.existingSigningKeyPath,
                            message: `[GordianOpenIntegrity] Update GordianOpenIntegrity Gordian Envelope at: ${PROVENANCE_FILE}`,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                            files: [{ path: PROVENANCE_FILE, content: provenanceContent }],
                        })

                        // 5. Update author context to use new key
                        author.sshKey = newSshKey
                        author.authorName = context.authorName
                        author.authorEmail = context.authorEmail

                        // 6. Update current lifehash for the new mark
                        const latest = await this.ledger.getLatest({ ledger: author.ledger })
                        await this._writeLifehashes({
                            repoDir: context.repoDir,
                            mark: latest.mark,
                        })

                        return { author, newFingerprint: newSshKey.fingerprint, mark: latest.mark }
                    }
                },

                commitToRepository: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        authorName: string
                        authorEmail: string
                        signingKeyPath: string
                        message: string
                        files?: Array<{ path: string; content: string }>
                        allowEmpty?: boolean
                    }) {
                        return this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: context.signingKeyPath,
                            message: context.message,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                            files: context.files,
                            allowEmpty: context.allowEmpty,
                        })
                    }
                },

                introduceDocument: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        authorName: string
                        authorEmail: string
                        trustKeyPath: string
                        provenanceKeyPath: string
                        document: any
                        documentPath: string
                        generatorPath: string
                        label?: string
                        trustUpdateMessage?: string
                        author: any
                    }) {
                        const { author } = context
                        const date = new Date()
                        const label = context.label || 'genesis'
                        const newDocument = context.document

                        // Derive encryption key from provenanceKeyPath
                        const encryptionKey = await this.key.deriveProvenanceSeed({ keyPath: context.provenanceKeyPath })

                        // 1. Add a Documents map assertion to the inception envelope
                        //    Maps document path → XID reference
                        const docXid = await this.xid.getXid({ document: newDocument })
                        const existingAssertions = author.ledger.assertions || []
                        // Parse existing Documents map or start fresh
                        const existingDocsAssertion = existingAssertions.find(
                            (a: any) => a.predicate === ASSERTION_DOCUMENTS
                        )
                        const docsMap: Record<string, string> = existingDocsAssertion
                            ? JSON.parse(existingDocsAssertion.object)
                            : {}
                        docsMap[context.documentPath] = docXid.toString()
                        // Replace the Documents assertion
                        author.ledger.assertions = [
                            ...existingAssertions.filter((a: any) => a.predicate !== ASSERTION_DOCUMENTS),
                            { predicate: ASSERTION_DOCUMENTS, object: JSON.stringify(docsMap) },
                        ]

                        // 2. Record the document introduction in the inception ledger
                        author.ledger = await this.ledger.commit({
                            ledger: author.ledger,
                            document: author.document,
                            label: `introduce:${context.documentPath}`,
                            date,
                        })

                        // 3. Create a ledger for the new document
                        //    Include the Document path assertion on the document's own envelope
                        const absDocPath = await this.fs.join({ parts: [context.repoDir, context.documentPath] })
                        const absGenPath = await this.fs.join({ parts: [context.repoDir, context.generatorPath] })
                        const docLedger = await this.ledger.createLedger({
                            document: newDocument,
                            documentPath: absDocPath,
                            generatorPath: absGenPath,
                            encryptionKey,
                            assertions: [
                                { predicate: ASSERTION_DOCUMENT, object: context.documentPath },
                            ],
                            contract: CONTRACT,
                            repositoryDid: author.ledger?.repositoryDid,
                        })

                        // 4. Advance the new document's ledger
                        const committedDocLedger = await this.ledger.commit({
                            ledger: docLedger,
                            document: newDocument,
                            label,
                            date: new Date(),
                        })

                        // 5. Read both YAML files and commit them to git
                        const inceptionDocPath = await this.fs.join({ parts: [context.repoDir, PROVENANCE_FILE] })
                        const inceptionContent = await this.fs.readFile({ path: inceptionDocPath })
                        const newDocContent = await this.fs.readFile({ path: absDocPath })

                        // Build commit message with optional trustUpdateMessage on second line
                        let commitMessage = `[GordianOpenIntegrity] Introduce new Gordian Envelope at: ${context.documentPath}`
                        if (context.trustUpdateMessage) {
                            commitMessage += `\n\n${context.trustUpdateMessage}`
                        }

                        await this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: context.trustKeyPath,
                            message: commitMessage,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                            files: [
                                { path: PROVENANCE_FILE, content: inceptionContent },
                                { path: context.documentPath, content: newDocContent },
                            ],
                        })

                        // 6. Update current lifehash for the new inception mark
                        const inceptionLatest = await this.ledger.getLatest({ ledger: author.ledger })
                        const docLatest = await this.ledger.getLatest({ ledger: committedDocLedger })
                        await this._writeLifehashes({
                            repoDir: context.repoDir,
                            mark: inceptionLatest.mark,
                        })

                        return {
                            author,
                            document: newDocument,
                            documentLedger: committedDocLedger,
                            inceptionMark: inceptionLatest.mark,
                            documentMark: docLatest.mark,
                        }
                    }
                },

                // ══════════════════════════════════════════════════════
                // VERIFIER — delegated to integrity capsule
                // ══════════════════════════════════════════════════════

                verify: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        mark?: string
                        strict?: {
                            repoIdentifierIsInceptionCommit?: boolean
                            signersAllAuthorized?: boolean
                        }
                    }) {
                        return this.integrity.verify(context)
                    }
                },

                verifyDocument: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        documentPath: string
                        mark?: string
                        strict?: {
                            repoIdentifierIsInceptionCommit?: boolean
                            signersAllAuthorized?: boolean
                        }
                    }) {
                        return this.integrity.verifyDocument(context)
                    }
                },

                // ── Author-side ledger queries ───────────────────────

                verifyLedger: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        author: any
                    }) {
                        return this.ledger.verify({ ledger: context.author.ledger })
                    }
                },

                verifyDocumentLedger: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        documentLedger: any
                    }) {
                        return this.ledger.verify({ ledger: context.documentLedger })
                    }
                },

                getLedgerLabels: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        author: any
                    }) {
                        return this.ledger.getLabels({ ledger: context.author.ledger })
                    }
                },

                getDocumentLedgerLabels: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        documentLedger: any
                    }) {
                        return this.ledger.getLabels({ ledger: context.documentLedger })
                    }
                },

                getLatestMark: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        author: any
                    }) {
                        const latest = await this.ledger.getLatest({ ledger: context.author.ledger })
                        return latest.mark
                    }
                },

                getMarkIdentifier: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: any
                    }) {
                        return this.provenanceMark.getIdentifier({ mark: context.mark })
                    }
                },

                _writeLifehashes: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        mark: any
                        inception?: boolean
                    }) {
                        const markId = await this.provenanceMark.getIdentifier({ mark: context.mark })
                        const image = await this.lifehash.makeFromUtf8({ input: markId })
                        const svg = await this.lifehash.toSVG({ image })

                        const oDir = await this.fs.join({ parts: [context.repoDir, '.o'] })
                        await this.fs.mkdir({ path: oDir })

                        // Always write the current lifehash
                        const currentPath = await this.fs.join({ parts: [context.repoDir, CURRENT_LIFEHASH_FILE] })
                        await this.fs.writeFile({ path: currentPath, content: svg })

                        // Write inception lifehash only on first creation
                        if (context.inception) {
                            const inceptionPath = await this.fs.join({ parts: [context.repoDir, INCEPTION_LIFEHASH_FILE] })
                            await this.fs.writeFile({ path: inceptionPath, content: svg })
                        }
                    }
                },

                provenancePath: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any) {
                        return PROVENANCE_FILE
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
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/GordianOpenIntegrity'
