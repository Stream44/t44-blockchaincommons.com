

import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { mkdirSync } from 'fs'


// ── Constants ────────────────────────────────────────────────────────

const PROVENANCE_FILE = '.o/GordianOpenIntegrity.yaml'
const GENERATOR_FILE = '.git/o/GordianOpenIntegrity-generator.yaml'
const ASSERTION_SSH = 'GordianOpenIntegrity'
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

                // ── Mapped dependencies ──────────────────────────────
                xid: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/xid'
                },
                ledger: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/XidDocumentLedger'
                },
                git: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/open-integrity-js'
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
                        provenancePassphrase?: string
                        provenanceDate?: Date
                    }) {
                        const { PrivateKeyBase } = await this.xid.types()
                        const docKeyBase = PrivateKeyBase.new()
                        return this.xid.createDocument({
                            keyType: 'privateKeyBase',
                            privateKeyBase: docKeyBase,
                            provenance: {
                                type: 'passphrase',
                                passphrase: context.provenancePassphrase || 'gordian-open-integrity-doc',
                                date: context.provenanceDate || new Date(),
                            },
                        })
                    }
                },

                createIdentity: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        privateKeyPath?: string
                        keyDir?: string
                        keyName?: string
                        key?: { privateKeyPath: string; publicKeyPath?: string; publicKey: string; fingerprint: string }
                        authorName: string
                        authorEmail: string
                        provenancePassphrase?: string
                        provenanceDate?: Date
                    }) {
                        const { PrivateKeyBase } = await this.xid.types()

                        // 1. Generate XID identity
                        const keyBase = PrivateKeyBase.new()
                        const document = await this.xid.createDocument({
                            keyType: 'privateKeyBase',
                            privateKeyBase: keyBase,
                            provenance: {
                                type: 'passphrase',
                                passphrase: context.provenancePassphrase || 'open-integrity',
                                date: context.provenanceDate || new Date(),
                            },
                        })

                        // 2. Use provided key, derive from privateKeyPath, or generate a new one
                        let sshKey: { privateKeyPath: string; publicKeyPath?: string; publicKey: string; fingerprint: string }
                        if (context.key) {
                            sshKey = context.key
                        } else if (context.privateKeyPath) {
                            sshKey = await this.git.readSigningKey({
                                privateKeyPath: context.privateKeyPath,
                            })
                        } else {
                            if (!context.keyDir) {
                                throw new Error('Either privateKeyPath, key, or keyDir must be provided to createIdentity')
                            }
                            const keyName = context.keyName || 'signing_ed25519'
                            sshKey = await this.git.generateSigningKey({
                                keyDir: context.keyDir,
                                keyName,
                            })
                        }

                        return {
                            keyBase,
                            document,
                            sshKey,
                            authorName: context.authorName,
                            authorEmail: context.authorEmail,
                        }
                    }
                },

                createRepository: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        author: any
                        message?: string
                        contract?: string
                        date?: Date
                    }) {
                        const { author } = context
                        const documentPath = join(context.repoDir, PROVENANCE_FILE)
                        const generatorPath = join(context.repoDir, GENERATOR_FILE)

                        // 1. Inception commit
                        const inception = await this.git.createInceptionCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: author.sshKey.privateKeyPath,
                            authorName: author.authorName,
                            authorEmail: author.authorEmail,
                            message: context.message,
                            contract: context.contract,
                        })

                        // 2. Create ledger — writes provenance.yaml and generator state
                        //    Include SSH key as an envelope assertion
                        const ledger = await this.ledger.createLedger({
                            document: author.document,
                            documentPath,
                            generatorPath,
                            assertions: [
                                { predicate: ASSERTION_SSH, object: author.sshKey.publicKey },
                            ],
                            contract: CONTRACT,
                            repositoryDid: inception.did,
                        })

                        // 3. Advance ledger for the SSH key link
                        author.ledger = await this.ledger.commit({
                            ledger,
                            document: author.document,
                            label: 'link-ssh-key',
                            date: context.date || new Date(),
                        })

                        // 4. Read the YAML that the ledger wrote and commit it
                        const provenanceContent = await readFile(documentPath, 'utf-8')
                        await this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: author.sshKey.privateKeyPath,
                            message: `[GordianOpenIntegrity] Establish inception Gordian Envelope at: ${PROVENANCE_FILE}\n\n${CONTRACT}`,
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
                            did: inception.did,
                            commitHash: inception.commitHash,
                            mark: latest.mark,
                        }
                    }
                },

                rotateKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        author: any
                        keyName?: string
                        date?: Date
                    }) {
                        const { author } = context
                        const { PrivateKeyBase } = await this.xid.types()
                        const date = context.date || new Date()

                        // 1. Generate new SSH key
                        const keyName = context.keyName || 'signing_rotated_ed25519'
                        const keyDir = join(author.sshKey.privateKeyPath, '..')
                        const newSshKey = await this.git.generateSigningKey({ keyDir, keyName })

                        // 2. Add new key to XID
                        const newKeyBase = PrivateKeyBase.new()
                        const addKeyResult = await this.xid.addKey({
                            document: author.document,
                            publicKeys: newKeyBase.ed25519PublicKeys(),
                            allowAll: true,
                        })

                        // Replace SSH key assertion (only the current key should appear)
                        const existingAssertions = author.ledger.assertions || []
                        author.ledger.assertions = [
                            ...existingAssertions.filter((a: any) => a.predicate !== ASSERTION_SSH),
                            { predicate: ASSERTION_SSH, object: newSshKey.publicKey },
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
                            date: new Date(date.getTime() + 1000),
                        })

                        // 4. Read the updated YAML and commit it (signed with OLD key, still valid)
                        const documentPath = join(context.repoDir, PROVENANCE_FILE)
                        const provenanceContent = await readFile(documentPath, 'utf-8')

                        await this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: author.sshKey.privateKeyPath,
                            message: `[GordianOpenIntegrity] Update GordianOpenIntegrity Gordian Envelope at: ${PROVENANCE_FILE}`,
                            authorName: author.authorName,
                            authorEmail: author.authorEmail,
                            files: [{ path: PROVENANCE_FILE, content: provenanceContent }],
                        })

                        // 5. Update author context to use new key
                        author.sshKey = newSshKey

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
                        author: any
                        message: string
                        files?: Array<{ path: string; content: string }>
                        allowEmpty?: boolean
                    }) {
                        return this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: context.author.sshKey.privateKeyPath,
                            message: context.message,
                            authorName: context.author.authorName,
                            authorEmail: context.author.authorEmail,
                            files: context.files,
                            allowEmpty: context.allowEmpty,
                        })
                    }
                },

                introduceDocument: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        author: any
                        document: any
                        documentPath: string
                        generatorPath: string
                        date?: Date
                        label?: string
                    }) {
                        const { author } = context
                        const date = context.date || new Date()
                        const label = context.label || 'genesis'
                        const newDocument = context.document

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
                        const absDocPath = join(context.repoDir, context.documentPath)
                        const absGenPath = join(context.repoDir, context.generatorPath)
                        const docLedger = await this.ledger.createLedger({
                            document: newDocument,
                            documentPath: absDocPath,
                            generatorPath: absGenPath,
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
                            date: new Date(date.getTime() + 1000),
                        })

                        // 5. Read both YAML files and commit them to git
                        const inceptionDocPath = join(context.repoDir, PROVENANCE_FILE)
                        const inceptionContent = await readFile(inceptionDocPath, 'utf-8')
                        const newDocContent = await readFile(absDocPath, 'utf-8')

                        await this.git.createSignedCommit({
                            repoDir: context.repoDir,
                            signingKeyPath: author.sshKey.privateKeyPath,
                            message: `[GordianOpenIntegrity] Introduce new Gordian Envelope at: ${context.documentPath}`,
                            authorName: author.authorName,
                            authorEmail: author.authorEmail,
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
                // VERIFIER — only needs the cloned repo + published mark
                // ══════════════════════════════════════════════════════

                verify: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        mark?: string
                    }) {
                        const issues: string[] = []

                        // 1. Collect all provenance documents from git history
                        const history = await this._collectProvenanceHistory({ repoDir: context.repoDir, documentPath: PROVENANCE_FILE })

                        if (history.length === 0) {
                            return {
                                valid: false,
                                issues: ['No provenance documents found in repository history'],
                            }
                        }

                        // 2. Verify provenance marks are monotonically advancing
                        const marks = history.map((h: any) => h.mark)
                        let marksMonotonic = true
                        for (let i = 1; i < marks.length; i++) {
                            const prevSeq = marks[i - 1].seq()
                            const currSeq = marks[i].seq()
                            if (currSeq <= prevSeq) {
                                marksMonotonic = false
                                issues.push(`Provenance mark sequence regressed: seq ${currSeq} <= ${prevSeq}`)
                            }
                        }

                        // 3. If a mark was provided, verify it matches the latest
                        let markMatchesLatest = true
                        if (context.mark) {
                            const latestMarkId = await this.provenanceMark.getIdentifier({ mark: marks[marks.length - 1] })
                            markMatchesLatest = latestMarkId === context.mark
                            if (!markMatchesLatest) {
                                issues.push(`Published mark "${context.mark}" does not match latest provenance mark "${latestMarkId}"`)
                            }
                        }

                        // 4. Collect all SSH keys from all provenance versions
                        const seen = new Set<string>()
                        const allSigners: Array<{ email: string; publicKey: string }> = []
                        for (const entry of history) {
                            for (const sshKey of entry.sshKeys) {
                                if (!seen.has(sshKey.publicKey)) {
                                    seen.add(sshKey.publicKey)
                                    allSigners.push({ email: 'xid-verifier@provenance', publicKey: sshKey.publicKey })
                                }
                            }
                        }

                        // 5. Audit all commit signatures
                        let audit: any
                        try {
                            audit = await this.git.auditRepository({
                                repoDir: context.repoDir,
                                allowedSigners: allSigners,
                            })
                        } catch {
                            return {
                                valid: false,
                                issues: [...issues, 'Failed to audit repository signatures'],
                            }
                        }

                        if (audit.invalidSignatures > 0) {
                            issues.push(`${audit.invalidSignatures} commit(s) have invalid signatures`)
                        }

                        // 6. Verify XID stability across all provenance versions
                        const xids = history.map((h: any) => h.xid)
                        const xidStable = xids.every((x: string) => x === xids[0])
                        if (!xidStable) {
                            issues.push('XID changed across provenance versions')
                        }

                        return {
                            valid: issues.length === 0,
                            xid: xids[0],
                            did: audit.did,
                            marksMonotonic,
                            markMatchesLatest,
                            xidStable,
                            totalCommits: audit.totalCommits,
                            validSignatures: audit.validSignatures,
                            invalidSignatures: audit.invalidSignatures,
                            provenanceVersions: history.length,
                            issues,
                        }
                    }
                },

                // ── Internal helpers ─────────────────────────────────

                verifyDocument: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        documentPath: string
                        mark?: string
                    }) {
                        const issues: string[] = []

                        // 1. Collect provenance history for this specific document
                        const history = await this._collectProvenanceHistory({
                            repoDir: context.repoDir,
                            documentPath: context.documentPath,
                        })

                        if (history.length === 0) {
                            return {
                                valid: false,
                                issues: [`No provenance documents found at ${context.documentPath}`],
                            }
                        }

                        // 2. Verify provenance marks are monotonically advancing
                        const marks = history.map((h: any) => h.mark)
                        let marksMonotonic = true
                        for (let i = 1; i < marks.length; i++) {
                            const prevSeq = marks[i - 1].seq()
                            const currSeq = marks[i].seq()
                            if (currSeq <= prevSeq) {
                                marksMonotonic = false
                                issues.push(`Provenance mark sequence regressed: seq ${currSeq} <= ${prevSeq}`)
                            }
                        }

                        // 3. If a mark was provided, verify it matches the latest
                        let markMatchesLatest = true
                        if (context.mark) {
                            const latestMarkId = await this.provenanceMark.getIdentifier({ mark: marks[marks.length - 1] })
                            markMatchesLatest = latestMarkId === context.mark
                            if (!markMatchesLatest) {
                                issues.push(`Published mark "${context.mark}" does not match latest provenance mark "${latestMarkId}"`)
                            }
                        }

                        // 4. Verify GordianOpenIntegrity.Document assertion matches the file path
                        const latestEntry = history[history.length - 1]
                        const docAssertions = await this.xid.getEnvelopeAssertions({
                            envelope: latestEntry.envelope,
                            predicate: ASSERTION_DOCUMENT,
                        })
                        let documentPathValid = false
                        if (docAssertions.length > 0 && docAssertions[0] === context.documentPath) {
                            documentPathValid = true
                        } else {
                            issues.push(
                                docAssertions.length === 0
                                    ? `Document envelope missing ${ASSERTION_DOCUMENT} assertion`
                                    : `Document path assertion "${docAssertions[0]}" does not match expected "${context.documentPath}"`
                            )
                        }

                        // 5. Verify the document is registered in the inception Documents map
                        const inceptionHistory = await this._collectProvenanceHistory({
                            repoDir: context.repoDir,
                            documentPath: PROVENANCE_FILE,
                        })

                        let documentsMapValid = false
                        const docXid = latestEntry.xid
                        if (inceptionHistory.length > 0) {
                            const latestInception = inceptionHistory[inceptionHistory.length - 1]

                            // Verify GordianOpenIntegrity.Documents map on inception
                            const docsAssertions = await this.xid.getEnvelopeAssertions({
                                envelope: latestInception.envelope,
                                predicate: ASSERTION_DOCUMENTS,
                            })
                            if (docsAssertions.length > 0) {
                                try {
                                    const docsMap = JSON.parse(docsAssertions[0])
                                    if (docsMap[context.documentPath] === docXid) {
                                        documentsMapValid = true
                                    } else {
                                        issues.push(`Documents map XID mismatch for "${context.documentPath}"`)
                                    }
                                } catch {
                                    issues.push('Failed to parse GordianOpenIntegrity.Documents assertion')
                                }
                            } else {
                                issues.push('Inception envelope missing GordianOpenIntegrity.Documents assertion')
                            }
                        } else {
                            issues.push('No inception provenance found in repository')
                        }

                        // 6. Verify XID stability across document versions
                        const xids = history.map((h: any) => h.xid)
                        const xidStable = xids.every((x: string) => x === xids[0])
                        if (!xidStable) {
                            issues.push('Document XID changed across provenance versions')
                        }

                        // 7. Audit all commit signatures using SSH keys from both histories
                        const seen = new Set<string>()
                        const allSigners: Array<{ email: string; publicKey: string }> = []
                        for (const entries of [history, inceptionHistory]) {
                            for (const entry of entries) {
                                for (const sshKey of entry.sshKeys) {
                                    if (!seen.has(sshKey.publicKey)) {
                                        seen.add(sshKey.publicKey)
                                        allSigners.push({ email: 'xid-verifier@provenance', publicKey: sshKey.publicKey })
                                    }
                                }
                            }
                        }

                        let audit: any
                        let totalCommits = 0
                        let validSignatures = 0
                        let invalidSignatures = 0
                        try {
                            audit = await this.git.auditRepository({
                                repoDir: context.repoDir,
                                allowedSigners: allSigners,
                            })
                            totalCommits = audit.totalCommits
                            validSignatures = audit.validSignatures
                            invalidSignatures = audit.invalidSignatures
                            if (audit.invalidSignatures > 0) {
                                issues.push(`${audit.invalidSignatures} commit(s) have invalid signatures`)
                            }
                        } catch {
                            issues.push('Failed to audit repository signatures')
                        }

                        return {
                            valid: issues.length === 0,
                            xid: docXid,
                            documentPathValid,
                            documentsMapValid,
                            marksMonotonic,
                            markMatchesLatest,
                            xidStable,
                            totalCommits,
                            validSignatures,
                            invalidSignatures,
                            provenanceVersions: history.length,
                            issues,
                        }
                    }
                },

                _collectProvenanceHistory: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        documentPath: string
                    }) {
                        const docPath = context.documentPath
                        const history: Array<{
                            xid: string
                            sshKeys: Array<{ publicKey: string }>
                            document: any
                            envelope: any
                            mark: any
                        }> = []

                        // Find all commits that touched the document file
                        const logResult = await this.git.exec({
                            args: ['log', '--all', '--reverse', '--format=%H', '--', docPath],
                            cwd: context.repoDir,
                        })

                        const hashes = logResult.stdout.trim().split('\n').filter((h: string) => h)

                        for (const hash of hashes) {
                            try {
                                const showResult = await this.git.exec({
                                    args: ['show', `${hash}:${docPath}`],
                                    cwd: context.repoDir,
                                })

                                const parsed = await this.ledger.parseProvenanceYaml({ yaml: showResult.stdout })

                                // Parse the envelope from UR string to extract assertions
                                const envelope = await this.xid.envelopeFromUrString({ urString: parsed.urString })
                                const document = await this.xid.fromEnvelope({ envelope })
                                const xidValue = await this.xid.getXid({ document })

                                // Extract SSH keys from envelope assertions
                                const sshKeys: Array<{ publicKey: string }> = []
                                const sshValues = await this.xid.getEnvelopeAssertions({
                                    envelope,
                                    predicate: ASSERTION_SSH,
                                })
                                for (const pubKey of sshValues) {
                                    sshKeys.push({ publicKey: pubKey })
                                }

                                // Get the provenance mark from the document
                                const provenanceResult = await this.xid.getProvenance({ document })

                                history.push({
                                    xid: xidValue.toString(),
                                    sshKeys,
                                    document,
                                    envelope,
                                    mark: provenanceResult.mark,
                                })
                            } catch {
                                // skip unparseable versions
                            }
                        }

                        return history
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

                        const oDir = join(context.repoDir, '.o')
                        mkdirSync(oDir, { recursive: true })

                        // Always write the current lifehash
                        await writeFile(join(context.repoDir, CURRENT_LIFEHASH_FILE), svg)

                        // Write inception lifehash only on first creation
                        if (context.inception) {
                            await writeFile(join(context.repoDir, INCEPTION_LIFEHASH_FILE), svg)
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
capsule['#'] = 't44/caps/providers/blockchaincommons.com/GordianOpenIntegrity'
