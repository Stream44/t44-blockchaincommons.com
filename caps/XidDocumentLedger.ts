

interface Revision {
    seq: number
    label: string
    date: Date
    document: any
    mark: any
}

interface Ledger {
    revisions: Revision[]
    xid: any
    storeDir?: string
    documentPath?: string
    generatorPath?: string
    encryptionKey?: Uint8Array
    assertions?: Array<{ predicate: string; object: string }>
    contract?: string
    inceptionMarkId?: string
    inceptionMarkHex?: string
    repositoryDid?: string
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

                // ── Mapped dependencies ──────────────────────────────
                fs: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/fs'
                },
                xid: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/xid'
                },
                provenanceMark: {
                    type: CapsulePropertyTypes.Mapping,
                    value: '@stream44.studio/t44-blockchaincommons.com/caps/provenance-mark'
                },

                // ── Internal helpers ─────────────────────────────────

                _getLedger: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { ledger: Ledger }): Promise<Ledger> {
                        if (!context.ledger || !context.ledger.revisions) {
                            throw new Error('Invalid ledger: must be created with createLedger')
                        }
                        return context.ledger
                    }
                },

                _assertNotEmpty: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { ledger: Ledger }) {
                        if (context.ledger.revisions.length === 0) {
                            throw new Error('Ledger is empty: commit a revision first')
                        }
                    }
                },

                // ── AES-256-GCM per-property encryption helpers ──────
                // When an encryptionKey is provided, only the sensitive properties
                // (seed, chainID, rngState) in generator files are encrypted at rest.
                // Encrypted values are prefixed: "aes-256-gcm:<keyFingerprint>:<base64(iv||ciphertext||tag)>"
                // Non-sensitive properties (res, nextSeq) remain in plaintext.

                _writeGeneratorFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { filePath: string; generatorJson: any; encryptionKey?: Uint8Array }) {
                        const output = { ...context.generatorJson }
                        if (context.encryptionKey) {
                            for (const field of ['seed', 'chainID', 'rngState']) {
                                if (output[field] !== undefined) {
                                    output[field] = await this.fs.encryptAes256Gcm({ key: context.encryptionKey, plaintext: String(output[field]) })
                                }
                            }
                        }
                        const dirPath = await this.fs.dirname({ path: context.filePath })
                        await this.fs.mkdir({ path: dirPath })
                        await this.fs.writeFile({ path: context.filePath, content: JSON.stringify(output, null, 2) })
                    }
                },

                _readGeneratorFile: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { filePath: string; encryptionKey?: Uint8Array }): Promise<any> {
                        const json = await this.fs.readJson({ path: context.filePath })
                        if (context.encryptionKey) {
                            for (const field of ['seed', 'chainID', 'rngState']) {
                                if (typeof json[field] === 'string' && json[field].startsWith('aes-256-gcm:')) {
                                    json[field] = await this.fs.decryptAes256Gcm({ key: context.encryptionKey, ciphertext: json[field] })
                                }
                            }
                        }
                        return json
                    }
                },

                // ──────────────────────────────────────────────────
                // Lifecycle
                // ──────────────────────────────────────────────────

                createLedger: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: any
                        storeDir?: string
                        documentPath?: string
                        generatorPath?: string
                        encryptionKey?: Uint8Array
                        assertions?: Array<{ predicate: string; object: string }>
                        contract?: string
                        repositoryDid?: string
                    }): Promise<Ledger> {
                        const doc = context.document
                        const xidValue = await this.xid.getXid({ document: doc })
                        const provenanceResult = await this.xid.getProvenance({ document: doc })
                        const provenance = provenanceResult.mark

                        if (!provenance) {
                            throw new Error('Document must have provenance enabled to create a ledger')
                        }

                        const snapshot = await this.xid.cloneDocument({ document: doc })
                        const seq = await this.provenanceMark.getSeq({ mark: provenance })
                        const date = await this.provenanceMark.getDate({ mark: provenance })

                        const revision: Revision = {
                            seq,
                            label: 'genesis',
                            date,
                            document: snapshot,
                            mark: provenance,
                        }

                        const inceptionMarkId = await this.provenanceMark.getBytewordsIdentifier({ mark: provenance })
                        const inceptionMarkHex = await this.provenanceMark.getIdentifier({ mark: provenance })

                        const ledger: Ledger = {
                            revisions: [revision],
                            xid: xidValue,
                            storeDir: context.storeDir,
                            documentPath: context.documentPath,
                            generatorPath: context.generatorPath,
                            encryptionKey: context.encryptionKey,
                            assertions: context.assertions,
                            contract: context.contract,
                            inceptionMarkId,
                            inceptionMarkHex,
                            repositoryDid: context.repositoryDid,
                        }

                        if (context.storeDir) {
                            await this.fs.mkdir({ path: context.storeDir })
                            const marksDir = await this.fs.join({ parts: [context.storeDir, 'marks'] })
                            await this.fs.mkdir({ path: marksDir })
                            const generator = provenanceResult.generator
                            const generatorStorePath = await this.fs.join({ parts: [context.storeDir, 'generator.json'] })
                            await this._writeGeneratorFile({ filePath: generatorStorePath, generatorJson: generator.toJSON(), encryptionKey: context.encryptionKey })

                            const { ProvenanceMarkInfo } = await this.provenanceMark.types()
                            const markInfo = ProvenanceMarkInfo.new(provenance, 'genesis')
                            const markPath = await this.fs.join({ parts: [context.storeDir, 'marks', `mark-${seq}.json`] })
                            await this.fs.writeJson({ path: markPath, data: markInfo.toJSON() })
                        }

                        // Write generator state to generatorPath (e.g. .git/oi-generator.json)
                        if (context.generatorPath) {
                            const generator = provenanceResult.generator
                            await this._writeGeneratorFile({ filePath: context.generatorPath, generatorJson: generator.toJSON(), encryptionKey: context.encryptionKey })
                        }

                        // Write provenance document YAML to documentPath
                        if (context.documentPath) {
                            const documentDir = await this.fs.dirname({ path: context.documentPath })
                            await this.fs.mkdir({ path: documentDir })
                            const yaml = await this.buildProvenanceYaml({ document: doc, mark: provenance, assertions: context.assertions, contract: context.contract, inceptionMarkId, inceptionMarkHex, repositoryDid: context.repositoryDid })
                            await this.fs.writeFile({ path: context.documentPath, content: yaml })
                        }

                        return ledger
                    }
                },

                commit: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                        document: any
                        label: string
                        date: Date
                    }): Promise<Ledger> {
                        const ledger = await this._getLedger({ ledger: context.ledger })

                        // Verify XID hasn't changed
                        const currentXid = await this.xid.getXid({ document: context.document })
                        if (!ledger.xid.equals(currentXid)) {
                            throw new Error('XID mismatch: document XID has changed since ledger creation')
                        }

                        // Advance provenance
                        await this.xid.advanceProvenance({ document: context.document, date: context.date })

                        const provenanceResult = await this.xid.getProvenance({ document: context.document })
                        const mark = provenanceResult.mark
                        const snapshot = await this.xid.cloneDocument({ document: context.document })
                        const seq = await this.provenanceMark.getSeq({ mark })
                        const markDate = await this.provenanceMark.getDate({ mark })

                        const revision: Revision = {
                            seq,
                            label: context.label,
                            date: markDate,
                            document: snapshot,
                            mark,
                        }

                        ledger.revisions.push(revision)

                        if (ledger.storeDir) {
                            const generator = provenanceResult.generator
                            const generatorStorePath = await this.fs.join({ parts: [ledger.storeDir, 'generator.json'] })
                            await this._writeGeneratorFile({ filePath: generatorStorePath, generatorJson: generator.toJSON(), encryptionKey: ledger.encryptionKey })

                            const { ProvenanceMarkInfo } = await this.provenanceMark.types()
                            const markInfo = ProvenanceMarkInfo.new(mark, context.label)
                            const markPath = await this.fs.join({ parts: [ledger.storeDir, 'marks', `mark-${seq}.json`] })
                            await this.fs.writeJson({ path: markPath, data: markInfo.toJSON() })
                        }

                        // Update generator state
                        if (ledger.generatorPath) {
                            const generator = provenanceResult.generator
                            await this._writeGeneratorFile({ filePath: ledger.generatorPath, generatorJson: generator.toJSON(), encryptionKey: ledger.encryptionKey })
                        }

                        // Update provenance document YAML
                        if (ledger.documentPath) {
                            const yaml = await this.buildProvenanceYaml({ document: context.document, mark, assertions: ledger.assertions, contract: ledger.contract, inceptionMarkId: ledger.inceptionMarkId, inceptionMarkHex: ledger.inceptionMarkHex, repositoryDid: ledger.repositoryDid })
                            await this.fs.writeFile({ path: ledger.documentPath, content: yaml })
                        }

                        return ledger
                    }
                },

                // ──────────────────────────────────────────────────
                // Queries
                // ──────────────────────────────────────────────────

                getRevision: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                        seq: number
                    }): Promise<Revision | undefined> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        return ledger.revisions.find((r: Revision) => r.seq === context.seq)
                    }
                },

                getRevisionByLabel: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                        label: string
                    }): Promise<Revision | undefined> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        return ledger.revisions.find((r: Revision) => r.label === context.label)
                    }
                },

                getLatest: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }): Promise<Revision> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        await this._assertNotEmpty({ ledger })
                        return ledger.revisions[ledger.revisions.length - 1]
                    }
                },

                getGenesis: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }): Promise<Revision> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        await this._assertNotEmpty({ ledger })
                        return ledger.revisions[0]
                    }
                },

                getXid: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }) {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        return ledger.xid
                    }
                },

                length: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }): Promise<number> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        return ledger.revisions.length
                    }
                },

                getRevisions: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }): Promise<Revision[]> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        return ledger.revisions
                    }
                },

                getLabels: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }): Promise<string[]> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        return ledger.revisions.map((r: Revision) => r.label)
                    }
                },

                getMarks: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }): Promise<any[]> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        return ledger.revisions.map((r: Revision) => r.mark)
                    }
                },

                // ──────────────────────────────────────────────────
                // Verification
                // ──────────────────────────────────────────────────

                verify: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }) {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        const issues: string[] = []

                        if (ledger.revisions.length === 0) {
                            return {
                                valid: false,
                                xidStable: false,
                                genesisPresent: false,
                                chainIntact: false,
                                sequenceValid: false,
                                datesMonotonic: false,
                                report: { marks: [], chains: [] },
                                issues: ['Ledger is empty'],
                            }
                        }

                        // 1. XID stability
                        let xidStable = true
                        for (const rev of ledger.revisions) {
                            const revXid = await this.xid.getXid({ document: rev.document })
                            if (!ledger.xid.equals(revXid)) {
                                xidStable = false
                                issues.push(`XID changed at revision ${rev.seq} (${rev.label})`)
                            }
                        }

                        // 2. Genesis present
                        const genesisPresent = await this.provenanceMark.isGenesis({ mark: ledger.revisions[0].mark })
                        if (!genesisPresent) {
                            issues.push('First revision is not a genesis mark')
                        }

                        // 3. Chain integrity (each mark precedes the next)
                        let chainIntact = true
                        for (let i = 0; i < ledger.revisions.length - 1; i++) {
                            const precedes = await this.provenanceMark.precedes({
                                mark: ledger.revisions[i].mark,
                                next: ledger.revisions[i + 1].mark,
                            })
                            if (!precedes) {
                                chainIntact = false
                                issues.push(`Chain break between revision ${ledger.revisions[i].seq} and ${ledger.revisions[i + 1].seq}`)
                            }
                        }

                        // 4. Sequence validity
                        const marks = ledger.revisions.map(r => r.mark)
                        let sequenceValid: boolean
                        if (marks.length >= 2) {
                            sequenceValid = await this.provenanceMark.isSequenceValid({ marks })
                        } else {
                            sequenceValid = marks.length === 1 && await this.provenanceMark.isGenesis({ mark: marks[0] })
                        }
                        if (!sequenceValid) {
                            issues.push('Provenance mark sequence is invalid')
                        }

                        // 5. Date monotonicity
                        let datesMonotonic = true
                        for (let i = 1; i < ledger.revisions.length; i++) {
                            const currDate = await this.provenanceMark.getDate({ mark: ledger.revisions[i].mark })
                            const prevDate = await this.provenanceMark.getDate({ mark: ledger.revisions[i - 1].mark })
                            if (currDate < prevDate) {
                                datesMonotonic = false
                                issues.push(`Date regression at revision ${ledger.revisions[i].seq}`)
                            }
                        }

                        // 6. Full validation report
                        const report = await this.provenanceMark.validate({ marks })
                        const reportHasIssues = await this.provenanceMark.hasIssues({ report })

                        const valid = xidStable && genesisPresent && chainIntact && sequenceValid && datesMonotonic && !reportHasIssues

                        return {
                            valid,
                            xidStable,
                            genesisPresent,
                            chainIntact,
                            sequenceValid,
                            datesMonotonic,
                            report,
                            issues,
                        }
                    }
                },

                // ──────────────────────────────────────────────────
                // Formatting
                // ──────────────────────────────────────────────────

                buildProvenanceYaml: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: any
                        mark: any
                        assertions?: Array<{ predicate: string; object: string }>
                        contract?: string
                        inceptionMarkId?: string
                        inceptionMarkHex?: string
                        repositoryDid?: string
                    }): Promise<string> {
                        const { XIDPrivateKeyOptions, XIDGeneratorOptions } = await this.xid.types()
                        let envelope = await this.xid.toEnvelope({
                            document: context.document,
                            privateKeyOptions: XIDPrivateKeyOptions.Omit,
                            generatorOptions: XIDGeneratorOptions.Omit,
                        })

                        // Add custom assertions to the envelope
                        if (context.assertions) {
                            for (const a of context.assertions) {
                                envelope = await this.xid.addEnvelopeAssertion({
                                    envelope,
                                    predicate: a.predicate,
                                    object: a.object,
                                })
                            }
                        }

                        const urString = envelope.urString()
                        const humanReadable = envelope.format()
                        const markId = await this.provenanceMark.getIdentifier({ mark: context.mark })

                        const doc: any = {
                            '$schema': 'https://json-schema.org/draft/2020-12/schema',
                            envelope: urString,
                            mark: markId,
                            '$defs': {
                                envelope: { '$ref': 'https://datatracker.ietf.org/doc/draft-mcnally-envelope/' },
                                mark: { '$ref': 'https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2025-001-provenance-mark.md' },
                            },
                        }

                        const lines: string[] = []
                        // Order: $schema, $defs, then properties
                        lines.push(`$schema: "${doc.$schema}"`)
                        lines.push(`$defs:`)
                        lines.push(`  envelope:`)
                        lines.push(`    $ref: "${doc.$defs.envelope.$ref}"`)
                        lines.push(`  mark:`)
                        lines.push(`    $ref: "${doc.$defs.mark.$ref}"`)
                        lines.push(`envelope: "${urString}"`)
                        lines.push(`mark: "${markId}"`)
                        lines.push('---')
                        if (context.repositoryDid) {
                            lines.push(`# Repository DID: ${context.repositoryDid}`)
                        }
                        const currentBytewords = await this.provenanceMark.getBytewordsIdentifier({ mark: context.mark })
                        lines.push(`# Current Mark: ${markId} (${currentBytewords})`)
                        if (context.inceptionMarkHex && context.inceptionMarkId) {
                            lines.push(`# Inception Mark: ${context.inceptionMarkHex} (${context.inceptionMarkId})`)
                        }
                        for (const line of humanReadable.split('\n')) {
                            lines.push(`# ${line}`)
                        }
                        if (context.contract) {
                            lines.push(`# ${context.contract}`)
                        }
                        return lines.join('\n') + '\n'
                    }
                },

                parseProvenanceYaml: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        yaml: string
                    }): Promise<{ urString: string; mark: string }> {
                        // Extract YAML block before the --- separator
                        const separatorIndex = context.yaml.indexOf('\n---')
                        const yamlBlock = separatorIndex >= 0
                            ? context.yaml.slice(0, separatorIndex)
                            : context.yaml
                        const lines = yamlBlock.split('\n')
                        let urString = ''
                        let mark = ''
                        for (const line of lines) {
                            if (line.startsWith('envelope:')) {
                                urString = line.slice('envelope:'.length).trim().replace(/^"|"$/g, '')
                            } else if (line.startsWith('mark:')) {
                                mark = line.slice('mark:'.length).trim().replace(/^"|"$/g, '')
                            }
                        }
                        return { urString, mark }
                    }
                },

                formatRevision: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        revision: Revision
                        privateKeyOptions?: any
                        generatorOptions?: any
                    }): Promise<string> {
                        const { XIDPrivateKeyOptions, XIDGeneratorOptions } = await this.xid.types()
                        const envelope = await this.xid.toEnvelope({
                            document: context.revision.document,
                            privateKeyOptions: context.privateKeyOptions ?? XIDPrivateKeyOptions.Omit,
                            generatorOptions: context.generatorOptions ?? XIDGeneratorOptions.Omit,
                        })
                        return envelope.format()
                    }
                },

                formatSummary: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        ledger: Ledger
                    }): Promise<string> {
                        const ledger = await this._getLedger({ ledger: context.ledger })
                        const lines: string[] = []
                        lines.push(`XID Ledger (${ledger.revisions.length} revision${ledger.revisions.length !== 1 ? 's' : ''})`)
                        lines.push(`XID: ${ledger.xid}`)
                        lines.push('')
                        for (const rev of ledger.revisions) {
                            const dateStr = rev.date.toISOString().replace('.000Z', 'Z')
                            const id = await this.provenanceMark.getIdentifier({ mark: rev.mark })
                            lines.push(`  #${rev.seq} [${id}] ${dateStr} "${rev.label}"`)
                        }
                        return lines.join('\n')
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
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/XidDocumentLedger'
