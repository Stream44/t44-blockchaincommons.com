

import {
    ProvenanceMark,
    ProvenanceMarkGenerator,
    ProvenanceMarkInfo,
    ProvenanceMarkResolution,
    type ValidationReport,
    type ValidationIssue,
    hasIssues,
    formatReport,
    ValidationReportFormat,
} from '@bcts/provenance-mark'


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

                createGenerator: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        type: 'passphrase' | 'random' | 'seed'
                        passphrase?: string
                        seed?: Uint8Array
                        resolution?: ProvenanceMarkResolution
                    }) {
                        const res = context.resolution ?? ProvenanceMarkResolution.Medium
                        if (context.type === 'passphrase') {
                            if (!context.passphrase) {
                                throw new Error('passphrase is required when type is "passphrase"')
                            }
                            return ProvenanceMarkGenerator.newWithPassphrase(res, context.passphrase)
                        } else if (context.type === 'seed') {
                            if (!context.seed) {
                                throw new Error('seed is required when type is "seed"')
                            }
                            return ProvenanceMarkGenerator.newUsing(res, context.seed)
                        } else {
                            return ProvenanceMarkGenerator.newRandom(res)
                        }
                    }
                },

                nextMark: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        generator: ProvenanceMarkGenerator
                        date: Date
                    }) {
                        return context.generator.next(context.date)
                    }
                },

                precedes: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                        next: ProvenanceMark
                    }) {
                        return context.mark.precedes(context.next)
                    }
                },

                isSequenceValid: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        marks: ProvenanceMark[]
                    }) {
                        return ProvenanceMark.isSequenceValid(context.marks)
                    }
                },

                validate: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        marks: ProvenanceMark[]
                    }): Promise<ValidationReport> {
                        return ProvenanceMark.validate(context.marks)
                    }
                },

                hasIssues: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        report: ValidationReport
                    }) {
                        return hasIssues(context.report)
                    }
                },

                formatReport: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        report: ValidationReport
                        format?: 'text' | 'json-compact' | 'json-pretty'
                    }) {
                        const fmt = context.format === 'json-compact'
                            ? ValidationReportFormat.JsonCompact
                            : context.format === 'json-pretty'
                                ? ValidationReportFormat.JsonPretty
                                : ValidationReportFormat.Text
                        return formatReport(context.report, fmt)
                    }
                },

                isGenesis: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                    }) {
                        return context.mark.isGenesis()
                    }
                },

                getSeq: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                    }) {
                        return context.mark.seq()
                    }
                },

                getDate: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                    }) {
                        return context.mark.date()
                    }
                },

                getChainId: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                    }) {
                        return context.mark.chainId()
                    }
                },

                getHash: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                    }) {
                        return context.mark.hash()
                    }
                },

                getIdentifier: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                    }) {
                        return context.mark.identifier()
                    }
                },

                getBytewordsIdentifier: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                        prefix?: boolean
                    }) {
                        return context.mark.bytewordsIdentifier(context.prefix ?? true)
                    }
                },

                toDebugString: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                    }) {
                        return context.mark.toDebugString()
                    }
                },

                markEquals: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        mark: ProvenanceMark
                        other: ProvenanceMark
                    }) {
                        return context.mark.equals(context.other)
                    }
                },

                // Expose library types for convenience
                types: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any) {
                        return {
                            ProvenanceMark,
                            ProvenanceMarkGenerator,
                            ProvenanceMarkInfo,
                            ProvenanceMarkResolution,
                            ValidationReportFormat,
                        }
                    }
                }

            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/provenance-mark'
