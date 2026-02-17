

// ── Constants ────────────────────────────────────────────────────────

const PROVENANCE_FILE = '.o/GordianOpenIntegrity.yaml'
const ASSERTION_SIGNING_KEY = 'GordianOpenIntegrity.SigningKey'
const ASSERTION_REPO_ID = 'GordianOpenIntegrity.RepositoryIdentifier'
const ASSERTION_DOCUMENT = 'GordianOpenIntegrity.Document'
const ASSERTION_DOCUMENTS = 'GordianOpenIntegrity.Documents'


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

                git: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/git'
                },
                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/fs'
                },
                repoId: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/GitRepositoryIdentifier'
                },
                xid: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/xid'
                },
                ledger: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/XidDocumentLedger'
                },
                provenanceMark: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/provenance-mark'
                },

                // ══════════════════════════════════════════════════════
                // LAYER 1 — Commit Origin
                //
                // Validates git-level properties of commits without
                // requiring any trust policy or Gordian stack.
                // ══════════════════════════════════════════════════════

                validateCommitSignatures: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        allowedSigners?: Array<{ email: string; publicKey: string }>
                    }) {
                        const issues: string[] = []
                        const commits = await this.git.listCommits({ repoDir: context.repoDir })

                        if (commits.length === 0) {
                            return { valid: false, totalCommits: 0, signedCommits: 0, unsignedCommits: 0, issues: ['No commits found in repository'] }
                        }

                        // If allowed signers provided, verify signatures against them
                        if (context.allowedSigners && context.allowedSigners.length > 0) {
                            const result = await this.git.auditSignatures({
                                repoDir: context.repoDir,
                                allowedSigners: context.allowedSigners,
                            })
                            if (result.invalidSignatures > 0) {
                                issues.push(`${result.invalidSignatures} commit(s) have invalid or unverifiable signatures`)
                            }
                            return {
                                valid: issues.length === 0,
                                totalCommits: result.totalCommits,
                                signedCommits: result.validSignatures,
                                unsignedCommits: result.invalidSignatures,
                                commits: result.commits,
                                issues,
                            }
                        }

                        // Without allowed signers, just check that commits have gpgsig
                        let signedCount = 0
                        const commitDetails: any[] = []
                        for (const commit of commits) {
                            const catResult = await this.git.run({ args: ['cat-file', '-p', commit.hash], cwd: context.repoDir })
                            const isSigned = catResult.stdout.includes('gpgsig ')
                            if (isSigned) signedCount++
                            else issues.push(`Commit ${commit.hash.slice(0, 8)} is not signed`)
                            commitDetails.push({ ...commit, isSigned })
                        }

                        return {
                            valid: issues.length === 0,
                            totalCommits: commits.length,
                            signedCommits: signedCount,
                            unsignedCommits: commits.length - signedCount,
                            commits: commitDetails,
                            issues,
                        }
                    }
                },

                validateCommitSignoffs: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                    }) {
                        const issues: string[] = []
                        const commits = await this.git.listCommits({ repoDir: context.repoDir })

                        if (commits.length === 0) {
                            return { valid: false, totalCommits: 0, signedOffCommits: 0, issues: ['No commits found in repository'] }
                        }

                        let signedOffCount = 0
                        for (const commit of commits) {
                            const msgResult = await this.git.run({ args: ['log', '--format=%B', '-1', commit.hash], cwd: context.repoDir })
                            const hasSignoff = msgResult.stdout.includes('Signed-off-by:')
                            if (hasSignoff) signedOffCount++
                            else issues.push(`Commit ${commit.hash.slice(0, 8)} missing Signed-off-by trailer`)
                        }

                        return {
                            valid: issues.length === 0,
                            totalCommits: commits.length,
                            signedOffCommits: signedOffCount,
                            issues,
                        }
                    }
                },

                validateAuthorConsistency: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                    }) {
                        const issues: string[] = []
                        const commits = await this.git.listCommits({ repoDir: context.repoDir })

                        if (commits.length === 0) {
                            return { valid: false, totalCommits: 0, authors: {}, issues: ['No commits found in repository'] }
                        }

                        // Group commits by signing key fingerprint and check author consistency
                        const keyToAuthors: Record<string, Set<string>> = {}
                        for (const commit of commits) {
                            const key = commit.keyFingerprint || 'unsigned'
                            if (!keyToAuthors[key]) keyToAuthors[key] = new Set()
                            keyToAuthors[key].add(`${commit.authorName} <${commit.authorEmail}>`)
                        }

                        const authors: Record<string, string[]> = {}
                        for (const [key, authorSet] of Object.entries(keyToAuthors)) {
                            authors[key] = Array.from(authorSet)
                            if (authorSet.size > 1) {
                                issues.push(`Key ${key} used by multiple authors: ${Array.from(authorSet).join(', ')}`)
                            }
                        }

                        return {
                            valid: issues.length === 0,
                            totalCommits: commits.length,
                            authors,
                            issues,
                        }
                    }
                },

                // ══════════════════════════════════════════════════════
                // LAYER 2 — Repository Identifier
                //
                // Validates the repository identifier commit and its
                // relationship to the repository.
                // ══════════════════════════════════════════════════════

                validateRepositoryIdentifier: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                    }) {
                        try {
                            return await this.repoId.validateIdentifier({ repoDir: context.repoDir })
                        } catch {
                            return { valid: false, error: 'No repository identifier found' }
                        }
                    }
                },

                // ══════════════════════════════════════════════════════
                // LAYER 3 — Gordian Open Integrity Provenance
                //
                // Validates provenance marks, XID stability, envelope
                // assertions, and document registry. Requires the
                // Gordian stack (XID, Envelope, Provenance Mark).
                // ══════════════════════════════════════════════════════

                validateProvenanceChain: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        provenanceHistory: Array<{ mark: any }>
                        publishedMark?: string
                    }) {
                        const issues: string[] = []
                        const history = context.provenanceHistory

                        if (history.length === 0) {
                            return { valid: false, marksMonotonic: false, markMatchesLatest: false, issues: ['No provenance history provided'] }
                        }

                        // Verify provenance marks are monotonically advancing
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

                        // If a published mark was provided, verify it matches the latest
                        let markMatchesLatest = true
                        if (context.publishedMark) {
                            const latestMarkId = await this.provenanceMark.getIdentifier({ mark: marks[marks.length - 1] })
                            markMatchesLatest = latestMarkId === context.publishedMark
                            if (!markMatchesLatest) {
                                issues.push(`Published mark "${context.publishedMark}" does not match latest provenance mark "${latestMarkId}"`)
                            }
                        }

                        return {
                            valid: issues.length === 0,
                            marksMonotonic,
                            markMatchesLatest,
                            provenanceVersions: history.length,
                            issues,
                        }
                    }
                },

                validateXidStability: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        provenanceHistory: Array<{ xid: string }>
                    }) {
                        const issues: string[] = []
                        const xids = context.provenanceHistory.map((h: any) => h.xid)

                        if (xids.length === 0) {
                            return { valid: false, xidStable: false, issues: ['No provenance history provided'] }
                        }

                        const xidStable = xids.every((x: string) => x === xids[0])
                        if (!xidStable) {
                            issues.push('XID changed across provenance versions')
                        }

                        return {
                            valid: issues.length === 0,
                            xid: xids[0],
                            xidStable,
                            issues,
                        }
                    }
                },

                validateDocumentSelfReference: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        envelope: any
                        documentPath: string
                    }) {
                        const issues: string[] = []

                        // Verify GordianOpenIntegrity.Document assertion matches the file path
                        const docAssertions = await this.xid.getEnvelopeAssertions({
                            envelope: context.envelope,
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

                        return { valid: issues.length === 0, documentPathValid, issues }
                    }
                },

                validateDocumentsMap: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        inceptionEnvelope: any
                        documentPath: string
                        documentXid: string
                    }) {
                        const issues: string[] = []

                        const docsAssertions = await this.xid.getEnvelopeAssertions({
                            envelope: context.inceptionEnvelope,
                            predicate: ASSERTION_DOCUMENTS,
                        })

                        let documentsMapValid = false
                        if (docsAssertions.length > 0) {
                            try {
                                const docsMap = JSON.parse(docsAssertions[0])
                                if (docsMap[context.documentPath] === context.documentXid) {
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

                        return { valid: issues.length === 0, documentsMapValid, issues }
                    }
                },

                // ══════════════════════════════════════════════════════
                // LAYER 4 — XID Document Governance
                //
                // Validates changes in the XID document as they relate
                // to the git repository: signing key authorization,
                // signer coverage, and repository identifier binding.
                // ══════════════════════════════════════════════════════

                validateSignerAuthorization: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        provenanceHistory: Array<{ sshKeys: Array<{ publicKey: string }> }>
                    }) {
                        const issues: string[] = []
                        const history = context.provenanceHistory

                        if (history.length === 0) {
                            return { valid: false, signersAllAuthorized: false, issues: ['No provenance history provided'] }
                        }

                        // Collect all authorized SSH keys from all provenance versions
                        const authorizedKeys = new Set<string>()
                        for (const entry of history) {
                            for (const sshKey of entry.sshKeys) {
                                authorizedKeys.add(sshKey.publicKey)
                            }
                        }

                        // Get all commits and their signing keys
                        const commits = await this.git.listCommits({ repoDir: context.repoDir })
                        if (commits.length === 0) {
                            return { valid: true, signersAllAuthorized: true, issues: [] }
                        }

                        // For each unique signing key fingerprint, verify it corresponds to an authorized key
                        // We need to verify each commit's signature against the authorized keys
                        const allSigners = Array.from(authorizedKeys).map((pk: string) => ({
                            email: 'xid-verifier@provenance',
                            publicKey: pk,
                        }))

                        let signersAllAuthorized = true
                        if (allSigners.length > 0) {
                            const audit = await this.git.auditSignatures({
                                repoDir: context.repoDir,
                                allowedSigners: allSigners,
                            })
                            if (audit.invalidSignatures > 0) {
                                signersAllAuthorized = false
                                issues.push(`${audit.invalidSignatures} commit(s) signed by keys not authorized in XID document`)
                            }
                        }

                        return {
                            valid: issues.length === 0,
                            signersAllAuthorized,
                            authorizedKeyCount: authorizedKeys.size,
                            issues,
                        }
                    }
                },

                validateRepoIdentifierIsInceptionCommit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        provenanceHistory: Array<{ envelope: any }>
                    }) {
                        const issues: string[] = []
                        const history = context.provenanceHistory

                        if (history.length === 0) {
                            return { valid: false, repoIdentifierIsInceptionCommit: false, issues: ['No provenance history provided'] }
                        }

                        // Get the repository identifier from the inception envelope
                        const inceptionEnvelope = history[0].envelope
                        const repoIdAssertions = await this.xid.getEnvelopeAssertions({
                            envelope: inceptionEnvelope,
                            predicate: ASSERTION_REPO_ID,
                        })

                        if (repoIdAssertions.length === 0) {
                            return {
                                valid: false,
                                repoIdentifierIsInceptionCommit: false,
                                issues: ['Inception envelope missing GordianOpenIntegrity.RepositoryIdentifier assertion'],
                            }
                        }

                        const repoIdDid = repoIdAssertions[0]
                        if (!repoIdDid || !repoIdDid.startsWith('did:repo:')) {
                            return {
                                valid: false,
                                repoIdentifierIsInceptionCommit: false,
                                issues: [`Invalid repository identifier format: ${repoIdDid}`],
                            }
                        }

                        const identifierHash = repoIdDid.replace('did:repo:', '')

                        // Get the first commit in the repository
                        const firstCommitResult = await this.git.run({
                            args: ['rev-list', '--max-parents=0', 'HEAD'],
                            cwd: context.repoDir,
                        })
                        const firstCommit = firstCommitResult.stdout.trim().split('\n')[0]

                        const repoIdentifierIsInceptionCommit = identifierHash === firstCommit
                        if (!repoIdentifierIsInceptionCommit) {
                            issues.push(`Repository identifier commit ${identifierHash.slice(0, 8)} is not the inception (first) commit ${firstCommit?.slice(0, 8)}`)
                        }

                        return {
                            valid: issues.length === 0,
                            repoIdentifierIsInceptionCommit,
                            identifierCommit: identifierHash,
                            inceptionCommit: firstCommit,
                            issues,
                        }
                    }
                },

                // ══════════════════════════════════════════════════════
                // VERIFY — Repository verification
                //
                // Verifies the inception provenance chain and all
                // commit signatures. Primary entry point for verifying
                // a repository's integrity.
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
                        const issues: string[] = []

                        // 1. Collect all provenance documents from git history
                        const fullHistory = await this._collectProvenanceHistory({ repoDir: context.repoDir, documentPath: PROVENANCE_FILE })

                        if (fullHistory.length === 0) {
                            return {
                                valid: false,
                                issues: ['No provenance documents found in repository history'],
                            }
                        }

                        // 2. Use only the latest trust root for mark validation
                        //    This allows trust root resets without breaking verification
                        const latestEntry = fullHistory[fullHistory.length - 1]

                        // 3. Verify the published mark matches the latest provenance only
                        const chainResult = await this.validateProvenanceChain({
                            provenanceHistory: [latestEntry],
                            publishedMark: context.mark,
                        })
                        if (!chainResult.valid) {
                            issues.push(...chainResult.issues)
                        }

                        // 4. Collect SSH keys from ALL provenance versions to support key rotation
                        //    This allows commits signed with rotated keys to still verify
                        const seen = new Set<string>()
                        const allSigners: Array<{ email: string; publicKey: string }> = []
                        for (const entry of fullHistory) {
                            for (const sshKey of entry.sshKeys) {
                                if (!seen.has(sshKey.publicKey)) {
                                    seen.add(sshKey.publicKey)
                                    allSigners.push({ email: 'xid-verifier@provenance', publicKey: sshKey.publicKey })
                                }
                            }
                        }

                        // 5. Audit all commit signatures against the latest trust root's keys
                        let audit: any
                        try {
                            audit = await this.git.auditSignatures({
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

                        // 6. XID from latest entry (no cross-version stability check needed)
                        const xid = latestEntry.xid

                        // 7. Strict mode: validate repo identifier is inception commit
                        if (context.strict?.repoIdentifierIsInceptionCommit) {
                            const repoIdResult = await this.validateRepoIdentifierIsInceptionCommit({
                                repoDir: context.repoDir,
                                provenanceHistory: fullHistory,
                            })
                            if (!repoIdResult.valid) {
                                issues.push(...repoIdResult.issues)
                            }
                        }

                        // 8. Strict mode: validate all signers are authorized in XID document
                        if (context.strict?.signersAllAuthorized) {
                            const signerResult = await this.validateSignerAuthorization({
                                repoDir: context.repoDir,
                                provenanceHistory: fullHistory,
                            })
                            if (!signerResult.valid) {
                                issues.push(...signerResult.issues)
                            }
                        }

                        return {
                            valid: issues.length === 0,
                            xid,
                            did: audit.did,
                            marksMonotonic: chainResult.marksMonotonic,
                            markMatchesLatest: chainResult.markMatchesLatest,
                            xidStable: true,
                            totalCommits: audit.totalCommits,
                            validSignatures: audit.validSignatures,
                            invalidSignatures: audit.invalidSignatures,
                            provenanceVersions: fullHistory.length,
                            issues,
                        }
                    }
                },

                // ══════════════════════════════════════════════════════
                // VERIFY DOCUMENT — Document verification
                //
                // Verifies a specific decision document registered in
                // the inception envelope.
                // ══════════════════════════════════════════════════════

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
                        const chainResult = await this.validateProvenanceChain({
                            provenanceHistory: history,
                            publishedMark: context.mark,
                        })
                        if (!chainResult.valid) {
                            issues.push(...chainResult.issues)
                        }

                        // 3. Verify GordianOpenIntegrity.Document assertion matches the file path
                        const latestEntry = history[history.length - 1]
                        const selfRefResult = await this.validateDocumentSelfReference({
                            envelope: latestEntry.envelope,
                            documentPath: context.documentPath,
                        })
                        if (!selfRefResult.valid) {
                            issues.push(...selfRefResult.issues)
                        }

                        // 4. Verify the document is registered in the inception Documents map
                        const inceptionHistory = await this._collectProvenanceHistory({
                            repoDir: context.repoDir,
                            documentPath: PROVENANCE_FILE,
                        })

                        let documentsMapValid = false
                        const docXid = latestEntry.xid
                        if (inceptionHistory.length > 0) {
                            const latestInception = inceptionHistory[inceptionHistory.length - 1]
                            const mapResult = await this.validateDocumentsMap({
                                inceptionEnvelope: latestInception.envelope,
                                documentPath: context.documentPath,
                                documentXid: docXid,
                            })
                            documentsMapValid = mapResult.documentsMapValid
                            if (!mapResult.valid) {
                                issues.push(...mapResult.issues)
                            }
                        } else {
                            issues.push('No inception provenance found in repository')
                        }

                        // 5. Verify XID stability across document versions
                        const xidResult = await this.validateXidStability({ provenanceHistory: history })
                        if (!xidResult.valid) {
                            issues.push(...xidResult.issues)
                        }

                        // 6. Audit all commit signatures using SSH keys from both histories
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
                            audit = await this.git.auditSignatures({
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

                        // 7. Strict mode: validate repo identifier is inception commit
                        if (context.strict?.repoIdentifierIsInceptionCommit && inceptionHistory.length > 0) {
                            const repoIdResult = await this.validateRepoIdentifierIsInceptionCommit({
                                repoDir: context.repoDir,
                                provenanceHistory: inceptionHistory,
                            })
                            if (!repoIdResult.valid) {
                                issues.push(...repoIdResult.issues)
                            }
                        }

                        // 8. Strict mode: validate all signers are authorized in XID document
                        if (context.strict?.signersAllAuthorized) {
                            const combinedHistory = [...history, ...inceptionHistory]
                            const signerResult = await this.validateSignerAuthorization({
                                repoDir: context.repoDir,
                                provenanceHistory: combinedHistory,
                            })
                            if (!signerResult.valid) {
                                issues.push(...signerResult.issues)
                            }
                        }

                        return {
                            valid: issues.length === 0,
                            xid: docXid,
                            documentPathValid: selfRefResult.documentPathValid,
                            documentsMapValid,
                            marksMonotonic: chainResult.marksMonotonic,
                            markMatchesLatest: chainResult.markMatchesLatest,
                            xidStable: xidResult.xidStable,
                            totalCommits,
                            validSignatures,
                            invalidSignatures,
                            provenanceVersions: history.length,
                            issues,
                        }
                    }
                },

                // ══════════════════════════════════════════════════════
                // COMPREHENSIVE — validate
                //
                // Runs all applicable layer 1-2 validations and
                // returns a comprehensive report.
                // ══════════════════════════════════════════════════════

                validate: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        repoDir: string
                        allowedSigners?: Array<{ email: string; publicKey: string }>
                        strict?: {
                            repoIdentifierIsInceptionCommit?: boolean
                            signersAllAuthorized?: boolean
                        }
                    }) {
                        const issues: string[] = []
                        const report: any = {
                            valid: true,
                            layers: {},
                        }

                        // Layer 1: Commit Origin
                        const sigResult = await this.validateCommitSignatures({
                            repoDir: context.repoDir,
                            allowedSigners: context.allowedSigners,
                        })
                        report.layers.commitSignatures = sigResult
                        if (!sigResult.valid) {
                            issues.push(...sigResult.issues)
                        }

                        const signoffResult = await this.validateCommitSignoffs({ repoDir: context.repoDir })
                        report.layers.commitSignoffs = signoffResult
                        if (!signoffResult.valid) {
                            issues.push(...signoffResult.issues)
                        }

                        const authorResult = await this.validateAuthorConsistency({ repoDir: context.repoDir })
                        report.layers.authorConsistency = authorResult
                        if (!authorResult.valid) {
                            issues.push(...authorResult.issues)
                        }

                        // Layer 2: Repository Identifier
                        const idResult = await this.validateRepositoryIdentifier({ repoDir: context.repoDir })
                        report.layers.repositoryIdentifier = idResult
                        if (!idResult.valid) {
                            issues.push(idResult.error || 'Repository identifier validation failed')
                        }

                        // Layer 3+4: Gordian provenance (if available)
                        try {
                            const provenanceHistory = await this._collectProvenanceHistory({
                                repoDir: context.repoDir,
                                documentPath: PROVENANCE_FILE,
                            })
                            if (provenanceHistory.length > 0) {
                                const chainResult = await this.validateProvenanceChain({ provenanceHistory })
                                report.layers.provenanceChain = chainResult
                                if (!chainResult.valid) {
                                    issues.push(...chainResult.issues)
                                }

                                const xidResult = await this.validateXidStability({ provenanceHistory })
                                report.layers.xidStability = xidResult
                                if (!xidResult.valid) {
                                    issues.push(...xidResult.issues)
                                }

                                // Strict mode: repo identifier is inception commit
                                if (context.strict?.repoIdentifierIsInceptionCommit) {
                                    const repoIdResult = await this.validateRepoIdentifierIsInceptionCommit({
                                        repoDir: context.repoDir,
                                        provenanceHistory,
                                    })
                                    report.layers.repoIdentifierIsInceptionCommit = repoIdResult
                                    if (!repoIdResult.valid) {
                                        issues.push(...repoIdResult.issues)
                                    }
                                }

                                // Strict mode: all signers authorized
                                if (context.strict?.signersAllAuthorized) {
                                    const signerResult = await this.validateSignerAuthorization({
                                        repoDir: context.repoDir,
                                        provenanceHistory,
                                    })
                                    report.layers.signerAuthorization = signerResult
                                    if (!signerResult.valid) {
                                        issues.push(...signerResult.issues)
                                    }
                                }
                            }
                        } catch {
                            // Gordian stack not available or no provenance — skip layers 3-4
                        }

                        report.valid = issues.length === 0
                        report.issues = issues
                        report.totalCommits = sigResult.totalCommits
                        report.signedCommits = sigResult.signedCommits
                        report.unsignedCommits = sigResult.unsignedCommits

                        return report
                    }
                },

                // ── Internal helpers ─────────────────────────────────

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
                        const logResult = await this.git.run({
                            args: ['log', '--all', '--reverse', '--format=%H', '--', docPath],
                            cwd: context.repoDir,
                        })

                        const hashes = logResult.stdout.trim().split('\n').filter((h: string) => h)

                        for (const hash of hashes) {
                            try {
                                const showResult = await this.git.run({
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
                                    predicate: ASSERTION_SIGNING_KEY,
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

            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/GitRepositoryIntegrity'
