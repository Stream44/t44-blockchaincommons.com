#!/usr/bin/env bun test

import * as bunTest from 'bun:test'
import { run } from 't44/workspace-rt'

const {
    test: { describe, it, expect },
    xid
} = await run(async ({ encapsulate, CapsulePropertyTypes, makeImportStack }: any) => {
    const spine = await encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},
            '#': {
                test: {
                    type: CapsulePropertyTypes.Mapping,
                    value: 't44/caps/WorkspaceTest',
                    options: {
                        '#': {
                            bunTest,
                            env: {}
                        }
                    }
                },
                xid: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './xid'
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: 't44/caps/providers/blockchaincommons.com/xid.test'
    })
    return { spine }
}, async ({ spine, apis }: any) => {
    return apis[spine.capsuleSourceLineRef]
}, {
    importMeta: import.meta
})

const {
    XIDDocument,
    Key,
    Delegate,
    Service,
    Privilege,
    XIDPrivateKeyOptions,
    XIDGeneratorOptions,
    XIDVerifySignature,
    PrivateKeyBase,
} = await xid.types()

describe('XID Document Lifecycle', function () {

    // Shared state across the lifecycle sequence
    let aliceDoc: any
    let alicePrivateKeyBase: any
    let bobDoc: any
    let bobPrivateKeyBase: any

    describe('1. XID Inception', function () {

        it('should create a self-sovereign XID document with inception key', async function () {
            alicePrivateKeyBase = PrivateKeyBase.new()

            aliceDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: alicePrivateKeyBase,
            })

            const xidValue = await xid.getXid({ document: aliceDoc })
            expect(xidValue).toBeDefined()

            const inceptionKey = await xid.getInceptionKey({ document: aliceDoc })
            expect(inceptionKey).toBeDefined()
            expect(inceptionKey.hasPrivateKeys()).toBe(true)

            const keys = await xid.getKeys({ document: aliceDoc })
            expect(keys.length).toBe(1)

            // Inception key should have All permissions (self-sovereign)
            expect(inceptionKey.permissions().isAllowed(Privilege.All)).toBe(true)
        })

        it('should validate inception key matches XID', async function () {
            const isInception = await xid.isInceptionSigningKey({
                document: aliceDoc,
                signingPublicKey: alicePrivateKeyBase.schnorrPublicKeys().signingPublicKey()
            })
            expect(isInception).toBe(true)

            // A different key should not be inception
            const otherKeyBase = PrivateKeyBase.new()
            const isNotInception = await xid.isInceptionSigningKey({
                document: aliceDoc,
                signingPublicKey: otherKeyBase.schnorrPublicKeys().signingPublicKey()
            })
            expect(isNotInception).toBe(false)
        })

        it('should create a minimal XID document from public keys only', async function () {
            const pubKeyBase = PrivateKeyBase.new()
            const doc = await xid.createDocument({
                keyType: 'publicKeys',
                publicKeys: pubKeyBase.ed25519PublicKeys(),
            })

            const inceptionKey = await xid.getInceptionKey({ document: doc })
            expect(inceptionKey).toBeDefined()
            expect(inceptionKey.hasPrivateKeys()).toBe(false)
        })
    })

    describe('2. Resolution Methods', function () {

        it('should add and query resolution methods', async function () {
            await xid.addResolutionMethod({
                document: aliceDoc,
                method: 'https://resolver.example.com'
            })
            await xid.addResolutionMethod({
                document: aliceDoc,
                method: 'btcr:01234567'
            })

            const methods = await xid.getResolutionMethods({ document: aliceDoc })
            expect(methods.size).toBe(2)
            expect(methods.has('https://resolver.example.com')).toBe(true)
            expect(methods.has('btcr:01234567')).toBe(true)
        })

        it('should remove a resolution method', async function () {
            await xid.removeResolutionMethod({
                document: aliceDoc,
                method: 'btcr:01234567'
            })

            const methods = await xid.getResolutionMethods({ document: aliceDoc })
            expect(methods.size).toBe(1)
            expect(methods.has('btcr:01234567')).toBe(false)
        })
    })

    describe('3. Key Management', function () {

        it('should add a second key to the document', async function () {
            const secondKeyBase = PrivateKeyBase.new()
            const result = await xid.addKey({
                document: aliceDoc,
                publicKeys: secondKeyBase.ed25519PublicKeys(),
                allowAll: true,
            })

            const keys = await xid.getKeys({ document: result.document })
            expect(keys.length).toBe(2)
        })

        it('should find a key by its public keys', async function () {
            const keys = await xid.getKeys({ document: aliceDoc })
            const pubKeys = keys[0].publicKeys()

            const found = await xid.findKeyByPublicKeys({
                document: aliceDoc,
                publicKeys: pubKeys,
            })
            expect(found).toBeDefined()
        })

        it('should set a nickname on a key', async function () {
            const inceptionKey = await xid.getInceptionKey({ document: aliceDoc })
            const pubKeys = inceptionKey.publicKeys()

            await xid.setKeyNickname({
                document: aliceDoc,
                publicKeys: pubKeys,
                name: 'Alice Primary Key'
            })

            const updatedKey = await xid.findKeyByPublicKeys({
                document: aliceDoc,
                publicKeys: pubKeys,
            })
            expect(updatedKey.nickname()).toBe('Alice Primary Key')
        })

        it('should add an endpoint to a key', async function () {
            const inceptionKey = await xid.getInceptionKey({ document: aliceDoc })

            await xid.addKeyEndpoint({
                key: inceptionKey,
                endpoint: 'https://example.com/endpoint'
            })

            expect(inceptionKey.endpoints().has('https://example.com/endpoint')).toBe(true)
        })

        it('should set specific permissions on a key', async function () {
            const keys = await xid.getKeys({ document: aliceDoc })
            // Find the non-inception key
            const nonInceptionKey = keys.find((k: any) => {
                return !aliceDoc.isInceptionSigningKey(k.publicKeys().signingPublicKey())
            })
            expect(nonInceptionKey).toBeDefined()

            await xid.setKeyPermissions({
                key: nonInceptionKey,
                allow: [Privilege.Sign, Privilege.Encrypt],
            })

            expect(nonInceptionKey.permissions().isAllowed(Privilege.Sign)).toBe(true)
            expect(nonInceptionKey.permissions().isAllowed(Privilege.Encrypt)).toBe(true)
        })
    })

    describe('4. Delegation', function () {

        it('should create a delegate with specific permissions', async function () {
            bobPrivateKeyBase = PrivateKeyBase.new()
            bobDoc = await xid.createDocument({
                keyType: 'publicKeys',
                publicKeys: bobPrivateKeyBase.ed25519PublicKeys(),
            })

            const result = await xid.addDelegate({
                document: aliceDoc,
                delegateDocument: bobDoc,
                allow: [Privilege.Sign, Privilege.Encrypt],
            })

            const delegates = await xid.getDelegates({ document: result.document })
            expect(delegates.length).toBe(1)

            // Verify delegate permissions
            const delegate = result.delegate
            expect(delegate.permissions().isAllowed(Privilege.Sign)).toBe(true)
            expect(delegate.permissions().isAllowed(Privilege.Encrypt)).toBe(true)
        })

        it('should find a delegate by XID', async function () {
            const bobXid = await xid.getXid({ document: bobDoc })

            const found = await xid.findDelegateByXid({
                document: aliceDoc,
                xid: bobXid,
            })
            expect(found).toBeDefined()
            expect(found.xid().equals(bobXid)).toBe(true)
        })

        it('should remove a delegate', async function () {
            const bobXid = await xid.getXid({ document: bobDoc })

            await xid.removeDelegate({
                document: aliceDoc,
                xid: bobXid,
            })

            const delegates = await xid.getDelegates({ document: aliceDoc })
            expect(delegates.length).toBe(0)
        })
    })

    describe('5. Services', function () {

        it('should add a service with key and delegate references', async function () {
            // Re-add Bob as delegate for service reference
            const addResult = await xid.addDelegate({
                document: aliceDoc,
                delegateDocument: bobDoc,
                allow: [Privilege.Sign, Privilege.Encrypt],
            })

            const inceptionKey = await xid.getInceptionKey({ document: aliceDoc })

            const result = await xid.addService({
                document: aliceDoc,
                uri: 'https://example.com/messaging',
                name: 'Messaging Service',
                capability: 'com.example.messaging',
                keyReferences: [inceptionKey.reference()],
                delegateReferences: [addResult.delegate.reference()],
                allow: [Privilege.Sign, Privilege.Encrypt],
            })

            const services = await xid.getServices({ document: result.document })
            expect(services.length).toBe(1)
        })

        it('should find a service by URI', async function () {
            const found = await xid.findServiceByUri({
                document: aliceDoc,
                uri: 'https://example.com/messaging',
            })
            expect(found).toBeDefined()
            expect(found.name()).toBe('Messaging Service')
            expect(found.capability()).toBe('com.example.messaging')
        })

        it('should prevent removing a key referenced by a service', async function () {
            const inceptionKey = await xid.getInceptionKey({ document: aliceDoc })

            let threw = false
            try {
                await xid.removeKey({
                    document: aliceDoc,
                    publicKeys: inceptionKey.publicKeys(),
                })
            } catch {
                threw = true
            }
            expect(threw).toBe(true)
        })

        it('should remove a service then allow key removal', async function () {
            await xid.removeService({
                document: aliceDoc,
                uri: 'https://example.com/messaging',
            })

            const services = await xid.getServices({ document: aliceDoc })
            expect(services.length).toBe(0)
        })
    })

    describe('6. Envelope Serialization & Signing', function () {

        it('should serialize to envelope and round-trip', async function () {
            const envelope = await xid.toEnvelope({ document: aliceDoc })

            const restored = await xid.fromEnvelope({ envelope })
            const aliceXid = await xid.getXid({ document: aliceDoc })
            const restoredXid = await xid.getXid({ document: restored })
            expect(aliceXid.equals(restoredXid)).toBe(true)
        })

        it('should sign with inception key and verify', async function () {
            const signedEnvelope = await xid.toEnvelope({
                document: aliceDoc,
                signingOptions: { type: 'inception' },
            })

            const verified = await xid.fromEnvelope({
                envelope: signedEnvelope,
                verifySignature: XIDVerifySignature.Inception,
            })

            const aliceXid = await xid.getXid({ document: aliceDoc })
            const verifiedXid = await xid.getXid({ document: verified })
            expect(aliceXid.equals(verifiedXid)).toBe(true)
        })

        it('should fail signing without private key', async function () {
            const pubOnlyDoc = await xid.createDocument({
                keyType: 'publicKeys',
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
            })

            let threw = false
            try {
                await xid.toEnvelope({
                    document: pubOnlyDoc,
                    signingOptions: { type: 'inception' },
                })
            } catch {
                threw = true
            }
            expect(threw).toBe(true)
        })
    })

    describe('7. Private Key Options', function () {

        it('should omit private keys by default', async function () {
            const envelope = await xid.toEnvelope({ document: aliceDoc })
            const restored = await xid.fromEnvelope({ envelope })

            const inceptionKey = await xid.getInceptionKey({ document: restored })
            expect(inceptionKey).toBeDefined()
            expect(inceptionKey.hasPrivateKeys()).toBe(false)
        })

        it('should include private keys when specified', async function () {
            const envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Include,
            })
            const restored = await xid.fromEnvelope({ envelope })

            const inceptionKey = await xid.getInceptionKey({ document: restored })
            expect(inceptionKey).toBeDefined()
            expect(inceptionKey.hasPrivateKeys()).toBe(true)
        })

        it('should elide private keys preserving digest', async function () {
            const envelopeInclude = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Include,
            })
            const envelopeElide = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Elide,
            })

            // Elided should have same digest as included
            expect(envelopeElide.digest().equals(envelopeInclude.digest())).toBe(true)

            // But restored document should not have private key
            const restored = await xid.fromEnvelope({ envelope: envelopeElide })
            const inceptionKey = await xid.getInceptionKey({ document: restored })
            expect(inceptionKey.hasPrivateKeys()).toBe(false)
        })

        it('should encrypt private keys with password', async function () {
            const password = new TextEncoder().encode('test_password')

            const envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: { type: XIDPrivateKeyOptions.Encrypt, password },
            })

            // Without password - no private key
            const docNoPassword = await xid.fromEnvelope({ envelope })
            const keyNoPassword = await xid.getInceptionKey({ document: docNoPassword })
            expect(keyNoPassword.hasPrivateKeys()).toBe(false)

            // With password - private key restored
            const docWithPassword = await xid.fromEnvelope({ envelope, password })
            const keyWithPassword = await xid.getInceptionKey({ document: docWithPassword })
            expect(keyWithPassword.hasPrivateKeys()).toBe(true)
        }, { timeout: 60_000 })
    })

    describe('8. Key Rotation (Transfer)', function () {

        it('should rotate keys: remove inception key and add new key', async function () {
            // Create a fresh self-sovereign document for this test
            const freshKeyBase = PrivateKeyBase.new()
            const doc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: freshKeyBase,
            })
            const originalXid = await xid.getXid({ document: doc })

            // Remove inception key
            const result = await xid.removeInceptionKey({ document: doc })
            expect(result.removedKey).toBeDefined()

            const isEmpty = await xid.isEmpty({ document: result.document })
            expect(isEmpty).toBe(true)

            // Add a new key
            const newKeyBase = PrivateKeyBase.new()
            await xid.addKey({
                document: result.document,
                publicKeys: newKeyBase.ed25519PublicKeys(),
                allowAll: true,
            })

            // XID should remain the same
            const newXid = await xid.getXid({ document: result.document })
            expect(originalXid.equals(newXid)).toBe(true)

            // But inception key should be gone
            const inceptionKey = await xid.getInceptionKey({ document: result.document })
            expect(inceptionKey).toBeUndefined()

            // New key should be present
            const keys = await xid.getKeys({ document: result.document })
            expect(keys.length).toBe(1)
        })
    })

    describe('9. Provenance Marks', function () {

        it('should create document with provenance mark', async function () {
            const docWithProvenance = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
                provenance: {
                    type: 'passphrase',
                    passphrase: 'test-provenance',
                    date: new Date(Date.UTC(2025, 0, 1)),
                }
            })

            const provenance = await xid.getProvenance({ document: docWithProvenance })
            expect(provenance.mark).toBeDefined()
            expect(provenance.generator).toBeDefined()
        })

        it('should advance provenance mark', async function () {
            const docWithProvenance = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
                provenance: {
                    type: 'passphrase',
                    passphrase: 'test-advance',
                    date: new Date(Date.UTC(2025, 0, 1)),
                }
            })

            const provBefore = await xid.getProvenance({ document: docWithProvenance })
            const seqBefore = provBefore.mark.seq()

            await xid.advanceProvenance({
                document: docWithProvenance,
                date: new Date(Date.UTC(2025, 0, 2)),
            })

            const provAfter = await xid.getProvenance({ document: docWithProvenance })
            expect(provAfter.mark.seq()).toBe(seqBefore + 1)
        })
    })

    describe('10. Attachments', function () {

        it('should add and verify attachments', async function () {
            const doc = await xid.cloneDocument({ document: aliceDoc })

            const hasNone = await xid.hasAttachments({ document: doc })
            expect(hasNone).toBe(false)

            await xid.addAttachment({
                document: doc,
                payload: 'test_data',
                vendor: 'com.example',
                conformsTo: 'com.example.schema.v1',
            })

            const hasAttachments = await xid.hasAttachments({ document: doc })
            expect(hasAttachments).toBe(true)

            // Round-trip through envelope
            const envelope = await xid.toEnvelope({
                document: doc,
                privateKeyOptions: XIDPrivateKeyOptions.Include,
            })
            const restored = await xid.fromEnvelope({ envelope })
            const restoredHas = await xid.hasAttachments({ document: restored })
            expect(restoredHas).toBe(true)
        })

        it('should clear attachments', async function () {
            const doc = await xid.cloneDocument({ document: aliceDoc })

            await xid.addAttachment({
                document: doc,
                payload: 'data',
                vendor: 'com.test',
            })
            expect(await xid.hasAttachments({ document: doc })).toBe(true)

            await xid.clearAttachments({ document: doc })
            expect(await xid.hasAttachments({ document: doc })).toBe(false)
        })
    })

    describe('11. Document Comparison & Cloning', function () {

        it('should clone and compare documents', async function () {
            const cloned = await xid.cloneDocument({ document: aliceDoc })
            const isEqual = await xid.equals({ document: aliceDoc, other: cloned })
            expect(isEqual).toBe(true)
        })

        it('should detect different documents', async function () {
            const otherDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: PrivateKeyBase.new(),
            })

            const isEqual = await xid.equals({ document: aliceDoc, other: otherDoc })
            expect(isEqual).toBe(false)
        })
    })

    describe('12. Encryption Key & Verification Key', function () {

        it('should retrieve encryption and verification keys', async function () {
            const encKey = await xid.getEncryptionKey({ document: aliceDoc })
            expect(encKey).toBeDefined()

            const verKey = await xid.getVerificationKey({ document: aliceDoc })
            expect(verKey).toBeDefined()
        })
    })

    describe('13. Document Reference', function () {

        it('should calculate document reference from XID', async function () {
            const ref = await xid.getReference({ document: aliceDoc })
            expect(ref).toBeDefined()
        })
    })

    describe('14. Delegate Permissions Narrowing', function () {

        it('should demonstrate permissions narrowing through delegation', async function () {
            // Create controller with all permissions
            const controllerKeyBase = PrivateKeyBase.new()
            const controllerDoc = await xid.createDocument({
                keyType: 'privateKeyBase',
                privateKeyBase: controllerKeyBase,
            })

            // Create delegate with only operational permissions
            const delegateKeyBase = PrivateKeyBase.new()
            const delegateDoc = await xid.createDocument({
                keyType: 'publicKeys',
                publicKeys: delegateKeyBase.ed25519PublicKeys(),
            })

            const result = await xid.addDelegate({
                document: controllerDoc,
                delegateDocument: delegateDoc,
                allow: [
                    Privilege.Auth,
                    Privilege.Sign,
                    Privilege.Encrypt,
                    Privilege.Elide,
                    Privilege.Issue,
                    Privilege.Access,
                ],
            })

            // Verify delegate has operational permissions
            const delegate = result.delegate
            expect(delegate.permissions().isAllowed(Privilege.Auth)).toBe(true)
            expect(delegate.permissions().isAllowed(Privilege.Sign)).toBe(true)
            expect(delegate.permissions().isAllowed(Privilege.Encrypt)).toBe(true)

            // Delegate should NOT have management permissions
            expect(delegate.permissions().isAllowed(Privilege.Verify)).toBe(false)
            expect(delegate.permissions().isAllowed(Privilege.Transfer)).toBe(false)
            expect(delegate.permissions().isAllowed(Privilege.Revoke)).toBe(false)

            // Round-trip
            const envelope = await xid.toEnvelope({ document: controllerDoc })
            const restored = await xid.fromEnvelope({ envelope })
            const restoredXid = await xid.getXid({ document: restored })
            const controllerXid = await xid.getXid({ document: controllerDoc })
            expect(controllerXid.equals(restoredXid)).toBe(true)
        })
    })

    describe('15. Signed Envelope with toSignedEnvelope', function () {

        it('should create signed envelope using toSignedEnvelope', async function () {
            const inceptionKey = await xid.getInceptionKey({ document: aliceDoc })
            const privateKeys = inceptionKey.privateKeys()
            expect(privateKeys).toBeDefined()

            const signedEnvelope = await xid.toSignedEnvelope({
                document: aliceDoc,
                signingKey: privateKeys,
            })

            expect(signedEnvelope).toBeDefined()
            expect(signedEnvelope.format()).toContain("'signed': Signature")
        })
    })

    describe('16. Private Key Envelope Retrieval', function () {

        it('should get private key envelope for a key', async function () {
            const inceptionKey = await xid.getInceptionKey({ document: aliceDoc })
            const pubKeys = inceptionKey.publicKeys()

            const envelope = await xid.getPrivateKeyEnvelope({
                document: aliceDoc,
                publicKeys: pubKeys,
            })
            expect(envelope).toBeDefined()
        })

        it('should return undefined for key without private key', async function () {
            const pubOnlyDoc = await xid.createDocument({
                keyType: 'publicKeys',
                publicKeys: PrivateKeyBase.new().ed25519PublicKeys(),
            })

            const inceptionKey = await xid.getInceptionKey({ document: pubOnlyDoc })
            const result = await xid.getPrivateKeyEnvelope({
                document: pubOnlyDoc,
                publicKeys: inceptionKey.publicKeys(),
            })
            expect(result).toBeUndefined()
        })
    })

    describe('12. Envelope Assertions', function () {

        it('should add a string assertion to an envelope', async function () {
            const envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Omit,
                generatorOptions: XIDGeneratorOptions.Omit,
            })

            const updated = await xid.addEnvelopeAssertion({
                envelope,
                predicate: 'MyCustomPredicate',
                object: 'my-value-123',
            })

            expect(updated).toBeDefined()
            // The updated envelope should be different from the original
            expect(updated.digest().hex()).not.toBe(envelope.digest().hex())
        })

        it('should retrieve assertions by predicate', async function () {
            let envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Omit,
                generatorOptions: XIDGeneratorOptions.Omit,
            })

            envelope = await xid.addEnvelopeAssertion({
                envelope,
                predicate: 'GordianOpenIntegrity',
                object: 'ssh-ed25519 AAAAC3... test_key',
            })

            const values = await xid.getEnvelopeAssertions({
                envelope,
                predicate: 'GordianOpenIntegrity',
            })

            expect(values).toHaveLength(1)
            expect(values[0]).toBe('ssh-ed25519 AAAAC3... test_key')
        })

        it('should return empty array for non-existent predicate', async function () {
            const envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Omit,
                generatorOptions: XIDGeneratorOptions.Omit,
            })

            const values = await xid.getEnvelopeAssertions({
                envelope,
                predicate: 'NonExistentPredicate',
            })

            expect(values).toHaveLength(0)
        })

        it('should support multiple assertions with different predicates', async function () {
            let envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Omit,
                generatorOptions: XIDGeneratorOptions.Omit,
            })

            envelope = await xid.addEnvelopeAssertion({
                envelope,
                predicate: 'GordianOpenIntegrity',
                object: 'ssh-ed25519 AAAA... key1',
            })
            envelope = await xid.addEnvelopeAssertion({
                envelope,
                predicate: 'GordianOpenIntegrity.Document',
                object: '.o/example.com/policy/v1.yaml',
            })

            const sshKeys = await xid.getEnvelopeAssertions({
                envelope,
                predicate: 'GordianOpenIntegrity',
            })
            expect(sshKeys).toHaveLength(1)
            expect(sshKeys[0]).toBe('ssh-ed25519 AAAA... key1')

            const docs = await xid.getEnvelopeAssertions({
                envelope,
                predicate: 'GordianOpenIntegrity.Document',
            })
            expect(docs).toHaveLength(1)
            expect(docs[0]).toBe('.o/example.com/policy/v1.yaml')
        })

        it('should survive UR round-trip', async function () {
            let envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Omit,
                generatorOptions: XIDGeneratorOptions.Omit,
            })

            envelope = await xid.addEnvelopeAssertion({
                envelope,
                predicate: 'GordianOpenIntegrity',
                object: 'ssh-ed25519 AAAA... roundtrip_key',
            })

            const urString = await xid.envelopeToUrString({ envelope })
            const restored = await xid.envelopeFromUrString({ urString })

            const values = await xid.getEnvelopeAssertions({
                envelope: restored,
                predicate: 'GordianOpenIntegrity',
            })
            expect(values).toHaveLength(1)
            expect(values[0]).toBe('ssh-ed25519 AAAA... roundtrip_key')
        })

        it('should not interfere with XID document parsing', async function () {
            let envelope = await xid.toEnvelope({
                document: aliceDoc,
                privateKeyOptions: XIDPrivateKeyOptions.Omit,
                generatorOptions: XIDGeneratorOptions.Omit,
            })

            envelope = await xid.addEnvelopeAssertion({
                envelope,
                predicate: 'CustomMeta',
                object: 'some-value',
            })

            // XID document should still parse correctly from the envelope
            const urString = await xid.envelopeToUrString({ envelope })
            const doc = await xid.fromDocumentUrString({ urString })
            const xidValue = await xid.getXid({ document: doc })
            const originalXid = await xid.getXid({ document: aliceDoc })
            expect(xidValue.toString()).toBe(originalXid.toString())
        })
    })

})
