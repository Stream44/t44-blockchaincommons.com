

import {
    XIDDocument,
    XID,
    Key,
    Delegate,
    Service,
    Privilege,
    XIDPrivateKeyOptions,
    XIDGeneratorOptions,
    XIDVerifySignature,
} from '@bcts/xid'
import {
    PrivateKeyBase,
    PublicKeys,
    PrivateKeys,
} from '@bcts/components'
import type { ProvenanceMarkResolution } from '@bcts/provenance-mark'


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

                createDocument: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        keyType?: 'default' | 'publicKeys' | 'privateKeyBase' | 'privateKeys'
                        privateKeyBase?: PrivateKeyBase
                        publicKeys?: PublicKeys
                        privateKeys?: PrivateKeys
                        provenance?: {
                            type: 'none' | 'passphrase' | 'seed'
                            passphrase?: string
                            seed?: Uint8Array
                            resolution?: ProvenanceMarkResolution
                            date?: Date
                        }
                    }) {
                        const keyType = context.keyType || 'default'
                        let keyOptions: any = { type: keyType }
                        if (keyType === 'publicKeys' && context.publicKeys) {
                            keyOptions = { type: 'publicKeys', publicKeys: context.publicKeys }
                        } else if (keyType === 'privateKeyBase' && context.privateKeyBase) {
                            keyOptions = { type: 'privateKeyBase', privateKeyBase: context.privateKeyBase }
                        } else if (keyType === 'privateKeys' && context.privateKeys && context.publicKeys) {
                            keyOptions = { type: 'privateKeys', privateKeys: context.privateKeys, publicKeys: context.publicKeys }
                        }

                        let markOptions: any = { type: 'none' }
                        if (context.provenance && context.provenance.type !== 'none') {
                            markOptions = { ...context.provenance }
                        }

                        return XIDDocument.new(keyOptions, markOptions)
                    }
                },

                getXid: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.xid()
                    }
                },

                addResolutionMethod: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; method: string }) {
                        context.document.addResolutionMethod(context.method)
                        return context.document
                    }
                },

                removeResolutionMethod: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; method: string }) {
                        context.document.removeResolutionMethod(context.method)
                        return context.document
                    }
                },

                getResolutionMethods: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.resolutionMethods()
                    }
                },

                addKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        key?: Key
                        publicKeys?: PublicKeys
                        privateKeyBase?: PrivateKeyBase
                        allowAll?: boolean
                    }) {
                        let key: Key
                        if (context.key) {
                            key = context.key
                        } else if (context.privateKeyBase) {
                            key = Key.newWithPrivateKeyBase(context.privateKeyBase)
                        } else if (context.publicKeys && context.allowAll) {
                            key = Key.newAllowAll(context.publicKeys)
                        } else if (context.publicKeys) {
                            key = Key.new(context.publicKeys)
                        } else {
                            throw new Error('Must provide key, publicKeys, or privateKeyBase')
                        }
                        context.document.addKey(key)
                        return { document: context.document, key }
                    }
                },

                getKeys: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.keys()
                    }
                },

                findKeyByPublicKeys: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; publicKeys: PublicKeys }) {
                        return context.document.findKeyByPublicKeys(context.publicKeys)
                    }
                },

                removeKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; publicKeys: PublicKeys }) {
                        context.document.removeKey(context.publicKeys)
                        return context.document
                    }
                },

                getInceptionKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.inceptionKey()
                    }
                },

                removeInceptionKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        const removed = context.document.removeInceptionKey()
                        return { document: context.document, removedKey: removed }
                    }
                },

                isInceptionSigningKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; signingPublicKey: any }) {
                        return context.document.isInceptionSigningKey(context.signingPublicKey)
                    }
                },

                setKeyNickname: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; publicKeys: PublicKeys; name: string }) {
                        context.document.setNameForKey(context.publicKeys, context.name)
                        return context.document
                    }
                },

                setKeyPermissions: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        key: Key
                        allow?: Privilege[]
                        deny?: Privilege[]
                    }) {
                        if (context.allow) {
                            for (const p of context.allow) {
                                context.key.permissions().addAllow(p)
                            }
                        }
                        if (context.deny) {
                            for (const p of context.deny) {
                                context.key.permissions().addDeny(p)
                            }
                        }
                        return context.key
                    }
                },

                addKeyEndpoint: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { key: Key; endpoint: string }) {
                        context.key.addEndpoint(context.endpoint)
                        return context.key
                    }
                },

                addDelegate: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        delegateDocument: XIDDocument
                        allow?: Privilege[]
                        deny?: Privilege[]
                    }) {
                        const delegate = Delegate.new(context.delegateDocument)
                        if (context.allow) {
                            for (const p of context.allow) {
                                delegate.permissions().addAllow(p)
                            }
                        }
                        if (context.deny) {
                            for (const p of context.deny) {
                                delegate.permissions().addDeny(p)
                            }
                        }
                        context.document.addDelegate(delegate)
                        return { document: context.document, delegate }
                    }
                },

                getDelegates: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.delegates()
                    }
                },

                findDelegateByXid: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; xid: XID }) {
                        return context.document.findDelegateByXid(context.xid)
                    }
                },

                removeDelegate: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; xid: XID }) {
                        context.document.removeDelegate(context.xid)
                        return context.document
                    }
                },

                addService: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        uri: string
                        name?: string
                        capability?: string
                        keyReferences?: any[]
                        delegateReferences?: any[]
                        allow?: Privilege[]
                    }) {
                        const service = Service.new(context.uri)
                        if (context.name) {
                            service.setName(context.name)
                        }
                        if (context.capability) {
                            service.addCapability(context.capability)
                        }
                        if (context.keyReferences) {
                            for (const ref of context.keyReferences) {
                                service.addKeyReference(ref)
                            }
                        }
                        if (context.delegateReferences) {
                            for (const ref of context.delegateReferences) {
                                service.addDelegateReference(ref)
                            }
                        }
                        if (context.allow) {
                            for (const p of context.allow) {
                                service.permissions().addAllow(p)
                            }
                        }
                        context.document.addService(service)
                        return { document: context.document, service }
                    }
                },

                getServices: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.services()
                    }
                },

                findServiceByUri: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; uri: string }) {
                        return context.document.findServiceByUri(context.uri)
                    }
                },

                removeService: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; uri: string }) {
                        context.document.removeService(context.uri)
                        return context.document
                    }
                },

                getProvenance: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return {
                            mark: context.document.provenance(),
                            generator: context.document.provenanceGenerator()
                        }
                    }
                },

                advanceProvenance: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        password?: Uint8Array
                        date?: Date
                    }) {
                        context.document.nextProvenanceMarkWithEmbeddedGenerator(
                            context.password,
                            context.date
                        )
                        return context.document
                    }
                },

                toEnvelope: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        privateKeyOptions?: any
                        generatorOptions?: any
                        signingOptions?: any
                    }) {
                        return context.document.toEnvelope(
                            context.privateKeyOptions ?? XIDPrivateKeyOptions.Omit,
                            context.generatorOptions ?? XIDGeneratorOptions.Omit,
                            context.signingOptions ?? { type: 'none' }
                        )
                    }
                },

                fromEnvelope: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        envelope: any
                        password?: Uint8Array
                        verifySignature?: XIDVerifySignature
                    }) {
                        return XIDDocument.fromEnvelope(
                            context.envelope,
                            context.password,
                            context.verifySignature ?? XIDVerifySignature.None
                        )
                    }
                },

                toSignedEnvelope: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        signingKey: any
                        privateKeyOptions?: any
                    }) {
                        return context.document.toSignedEnvelopeOpt(
                            context.signingKey,
                            context.privateKeyOptions ?? XIDPrivateKeyOptions.Omit
                        )
                    }
                },

                addAttachment: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        payload: any
                        vendor: string
                        conformsTo?: string
                    }) {
                        context.document.addAttachment(context.payload, context.vendor, context.conformsTo)
                        return context.document
                    }
                },

                hasAttachments: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.hasAttachments()
                    }
                },

                clearAttachments: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        context.document.clearAttachments()
                        return context.document
                    }
                },

                cloneDocument: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.clone()
                    }
                },

                getEncryptionKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.encryptionKey()
                    }
                },

                getVerificationKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.verificationKey()
                    }
                },

                getReference: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.reference()
                    }
                },

                isEmpty: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument }) {
                        return context.document.isEmpty()
                    }
                },

                equals: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { document: XIDDocument; other: XIDDocument }) {
                        return context.document.equals(context.other)
                    }
                },

                getPrivateKeyEnvelope: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        publicKeys: PublicKeys
                        password?: string
                    }) {
                        return context.document.privateKeyEnvelopeForKey(context.publicKeys, context.password)
                    }
                },

                addEnvelopeAssertion: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        envelope: any
                        predicate: string
                        object: string
                    }) {
                        return context.envelope.addAssertion(context.predicate, context.object)
                    }
                },

                getEnvelopeAssertions: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        envelope: any
                        predicate: string
                    }): Promise<string[]> {
                        const assertions = context.envelope.assertionsWithPredicate(context.predicate)
                        return assertions.map((a: any) => {
                            const obj = a.subject().asObject()
                            return obj ? (obj.asText?.() ?? obj.format?.() ?? '') : ''
                        }).filter((s: string) => s !== '')
                    }
                },

                envelopeToUrString: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { envelope: any }) {
                        return context.envelope.urString()
                    }
                },

                envelopeFromUrString: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { urString: string }) {
                        // Get Envelope class from a temporary document's envelope
                        const tmpDoc = XIDDocument.new({ type: 'default' }, { type: 'none' })
                        const tmpEnvelope = tmpDoc.toEnvelope()
                        const EnvelopeClass = tmpEnvelope.constructor as any
                        return EnvelopeClass.fromUrString(context.urString)
                    }
                },

                toDocumentUrString: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        document: XIDDocument
                        privateKeyOptions?: any
                        generatorOptions?: any
                    }) {
                        const envelope = context.document.toEnvelope(
                            context.privateKeyOptions ?? XIDPrivateKeyOptions.Omit,
                            context.generatorOptions ?? XIDGeneratorOptions.Omit,
                            { type: 'none' }
                        )
                        return envelope.urString()
                    }
                },

                fromDocumentUrString: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: {
                        urString: string
                        password?: Uint8Array
                    }) {
                        const tmpDoc = XIDDocument.new({ type: 'default' }, { type: 'none' })
                        const tmpEnvelope = tmpDoc.toEnvelope()
                        const EnvelopeClass = tmpEnvelope.constructor as any
                        const envelope = EnvelopeClass.fromUrString(context.urString)
                        return XIDDocument.fromEnvelope(envelope, context.password, XIDVerifySignature.None)
                    }
                },

                // Expose library types for convenience
                types: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any) {
                        return {
                            XIDDocument,
                            XID,
                            Key,
                            Delegate,
                            Service,
                            Privilege,
                            XIDPrivateKeyOptions,
                            XIDGeneratorOptions,
                            XIDVerifySignature,
                            PrivateKeyBase,
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
capsule['#'] = 't44/caps/providers/blockchaincommons.com/xid'
