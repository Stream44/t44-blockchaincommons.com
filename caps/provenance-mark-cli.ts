
import {
    NewCommand,
    NextCommand,
    PrintCommand,
    ValidateCommand,
    OutputFormat,
    Resolution,
    ValidateFormat,
    type NewCommandArgs,
    type NextCommandArgs,
    type PrintCommandArgs,
    type ValidateCommandArgs,
    defaultNewCommandArgs,
    defaultNextCommandArgs,
    defaultPrintCommandArgs,
    defaultValidateCommandArgs,
} from '@bcts/provenance-mark-cli'


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

                newChain: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        path: string
                        resolution?: 'low' | 'medium' | 'quartile' | 'high'
                        comment?: string
                        date?: Date
                        seed?: string
                        format?: 'markdown' | 'ur' | 'json'
                        quiet?: boolean
                    }) {
                        const args: NewCommandArgs = {
                            ...defaultNewCommandArgs(),
                            path: context.path,
                        }
                        if (context.resolution) {
                            args.resolution = context.resolution as Resolution
                        }
                        if (context.comment !== undefined) {
                            args.comment = context.comment
                        }
                        if (context.date) {
                            args.date = context.date
                        }
                        if (context.format) {
                            args.format = context.format as OutputFormat
                        }
                        if (context.quiet !== undefined) {
                            args.quiet = context.quiet
                        }
                        const cmd = new NewCommand(args)
                        return cmd.exec()
                    }
                },

                nextMark: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        path: string
                        comment?: string
                        date?: Date
                        format?: 'markdown' | 'ur' | 'json'
                        quiet?: boolean
                    }) {
                        const args: NextCommandArgs = {
                            ...defaultNextCommandArgs(),
                            path: context.path,
                        }
                        if (context.comment !== undefined) {
                            args.comment = context.comment
                        }
                        if (context.date) {
                            args.date = context.date
                        }
                        if (context.format) {
                            args.format = context.format as OutputFormat
                        }
                        if (context.quiet !== undefined) {
                            args.quiet = context.quiet
                        }
                        const cmd = new NextCommand(args)
                        return cmd.exec()
                    }
                },

                print: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        path: string
                        start?: number
                        end?: number
                        format?: 'markdown' | 'ur' | 'json'
                    }) {
                        const args: PrintCommandArgs = {
                            ...defaultPrintCommandArgs(),
                            path: context.path,
                        }
                        if (context.start !== undefined) {
                            args.start = context.start
                        }
                        if (context.end !== undefined) {
                            args.end = context.end
                        }
                        if (context.format) {
                            args.format = context.format as OutputFormat
                        }
                        const cmd = new PrintCommand(args)
                        return cmd.exec()
                    }
                },

                validate: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        dir?: string
                        marks?: string[]
                        warn?: boolean
                        format?: 'text' | 'json-compact' | 'json-pretty'
                    }) {
                        const args: ValidateCommandArgs = {
                            ...defaultValidateCommandArgs(),
                        }
                        if (context.dir) {
                            args.dir = context.dir
                        }
                        if (context.marks) {
                            args.marks = context.marks
                        }
                        if (context.warn !== undefined) {
                            args.warn = context.warn
                        }
                        if (context.format) {
                            args.format = context.format as ValidateFormat
                        }
                        const cmd = new ValidateCommand(args)
                        return cmd.exec()
                    }
                },

                types: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any) {
                        return {
                            OutputFormat,
                            Resolution,
                            ValidateFormat,
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
capsule['#'] = 't44/caps/providers/blockchaincommons.com/provenance-mark-cli'
