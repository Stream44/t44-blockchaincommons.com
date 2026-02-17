
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

                sshKeygen: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { args: string[] }) {
                        return this.git.exec({ cmd: ['ssh-keygen', ...context.args], cwd: '/tmp' })
                    }
                },

                getFingerprint: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { signingKeyPath: string }): Promise<string> {
                        const fpResult = await this.sshKeygen({ args: ['-E', 'sha256', '-lf', context.signingKeyPath] })
                        if (fpResult.exitCode !== 0) {
                            throw new Error(`ssh-keygen fingerprint failed: ${fpResult.stderr}`)
                        }
                        return fpResult.stdout.split(' ')[1] || ''
                    }
                },

                readSigningKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { privateKeyPath: string }) {
                        const keyPath = context.privateKeyPath
                        const publicKey = (await this.fs.readFile({ path: `${keyPath}.pub` })).trim()
                        const fingerprint = await this.getFingerprint({ signingKeyPath: keyPath })
                        return { privateKeyPath: keyPath, publicKeyPath: `${keyPath}.pub`, publicKey, fingerprint }
                    }
                },

                generateSigningKey: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { keyDir: string; keyName?: string; passphrase?: string }) {
                        const keyName = context.keyName || 'sign_id_ed25519'
                        const keyPath = await this.fs.join({ parts: [context.keyDir, keyName] })
                        const passphrase = context.passphrase || ''
                        await this.fs.mkdir({ path: context.keyDir })
                        const result = await this.sshKeygen({ args: ['-t', 'ed25519', '-f', keyPath, '-N', passphrase, '-C', keyName] })
                        if (result.exitCode !== 0) {
                            throw new Error(`ssh-keygen failed: ${result.stderr}`)
                        }
                        const publicKey = (await this.fs.readFile({ path: `${keyPath}.pub` })).trim()
                        const fingerprint = await this.getFingerprint({ signingKeyPath: keyPath })
                        return { privateKeyPath: keyPath, publicKeyPath: `${keyPath}.pub`, publicKey, fingerprint }
                    }
                },

                // ── Key derivation ───────────────────────────────────

                deriveKeyBase: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { keyPath: string; PrivateKeyBase: any }) {
                        const keyFileData = await this.fs.readFileBuffer({ path: context.keyPath })
                        const xidSeed = await this.fs.sha256({ data: keyFileData })
                        return context.PrivateKeyBase.fromData(xidSeed)
                    }
                },

                deriveProvenanceSeed: {
                    type: CapsulePropertyTypes.Function,
                    value: async function (this: any, context: { keyPath: string }) {
                        const keyFileData = await this.fs.readFileBuffer({ path: context.keyPath })
                        return this.fs.sha256({ data: keyFileData })
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
capsule['#'] = '@stream44.studio/t44-blockchaincommons.com/caps/key'
