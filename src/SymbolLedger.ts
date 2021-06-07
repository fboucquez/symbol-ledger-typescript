/*
 * Copyright 2021 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import Transport from '@ledgerhq/hw-transport';
import { LedgerDerivationPath, LedgerNetworkType, LedgerTransaction } from './sdk';

export interface AppVersion {
    majorVersion: number;
    minorVersion: number;
    patchVersion: number;
}

/**
 * The
 */
export interface ApduPackage {
    p1: number;
    p2: number;
    data: Buffer;
    cla: number;
    ins: number;
}

const SUPPORT_VERSION: AppVersion = { majorVersion: 1, minorVersion: 0, patchVersion: 0 };
const CLA_FIELD = 0xe0;

/**
 * The symbol ledger clients that knows who to talk to the symbol app installed in the ledger device.
 *
 * This facade simplifies provides an simplifies the basic methods.
 */
export class SymbolLedger {
    /**
     * The transport to be used when talking to ledger.
     */
    private readonly transport: Transport;

    constructor(transport: Transport, scrambleKey: string) {
        this.transport = transport;
        transport.decorateAppAPIMethods(
            this,
            ['getAppVersion', 'getAccount', 'signTransaction', 'signCosignatureTransaction'],
            scrambleKey,
        );
    }
    /**
     * Return true if the installed app version is above the supported Symbol app version
     * @return promise of boolean
     */
    public async isAppSupported(): Promise<boolean> {
        const appVersion = await this.getAppVersion();
        return this.isVersionSupported(appVersion, this.getExpectedAppVersion());
    }

    /**
     * Returns the minimum expected ledger version.
     * @return the expected version object
     */
    public getExpectedAppVersion(): AppVersion {
        return SUPPORT_VERSION;
    }

    /**
     * Compares the current app version to a expected version.  Returns if the app version is greater equals te expected one
     * @param appVersion the app version
     * @param expectedVersion the expected version.
     */
    public isVersionSupported(appVersion: AppVersion, expectedVersion: AppVersion): boolean {
        if (appVersion.majorVersion > expectedVersion.majorVersion) {
            return true;
        } else if (appVersion.majorVersion == expectedVersion.majorVersion) {
            if (appVersion.minorVersion > expectedVersion.minorVersion) {
                return true;
            } else if (appVersion.minorVersion == expectedVersion.minorVersion) {
                return appVersion.patchVersion >= expectedVersion.patchVersion;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    /**
     * Get Symbol app version on Ledger device

     * @return an object contain major, minor, patch version of the Symbol app on Ledger device
     */
    public async getAppVersion(): Promise<AppVersion> {
        // APDU fields configuration
        const apdu: ApduPackage = {
            cla: 0xe0,
            ins: 0x06,
            p1: 0x00,
            p2: 0x00,
            data: Buffer.alloc(1, 0x00, 'hex'),
        };
        // Response from Ledger
        const response = await this.sendPackage(apdu);
        return {
            majorVersion: response[1],
            minorVersion: response[2],
            patchVersion: response[3],
        };
    }

    /**
     * get Symbol's address for a given BIP 44 path from the Ledger
     *
     * @param path a path in BIP 44 format
     * @param display optionally enable or not the display
     * @param networkType the symbol network type number
     * @param chainCode optionally enable or not the chainCode request
     * @param isOptinLedgerWallet if Opt-in Symbol wallet uses curve Secp256K1 else uses curve Ed25519
     * @return the public key of the account.
     */
    async getAccount(
        path: string,
        networkType: LedgerNetworkType,
        display: boolean,
        chainCode: boolean,
        isOptinLedgerWallet: boolean,
    ): Promise<string> {
        const GET_ACCOUNT_INS_FIELD = 0x02;

        const bipPath = LedgerDerivationPath.getBipPathArray(path);
        const curveMask = isOptinLedgerWallet ? 0x40 : 0x80;

        // APDU fields configuration
        const apdu = {
            cla: CLA_FIELD,
            ins: GET_ACCOUNT_INS_FIELD,
            p1: display ? 0x01 : 0x00,
            p2: curveMask | (chainCode ? 0x01 : 0x00),
            data: Buffer.alloc(1 + bipPath.length * 4 + 1),
        };

        apdu.data.writeInt8(bipPath.length, 0);
        bipPath.forEach((segment: number, index: number) => {
            apdu.data.writeUInt32BE(segment, 1 + index * 4);
        });
        apdu.data.writeUInt8(networkType, 1 + bipPath.length * 4);

        // Response from Ledger
        const response = await this.sendPackage(apdu);

        const publicKeyLength = response[0];
        if (publicKeyLength !== 32) {
            throw new Error(`Invalid public key length of ${publicKeyLength}`);
        }
        return response.slice(1, 1 + publicKeyLength).toString('hex');
    }

    /**
     * sign a Symbol transaction by account on Ledger at given BIP 44 path
     *
     * @param path a path in BIP 44 format
     * @param transaction a transaction needs to be signed
     * @param networkGenerationHash the network generation hash of block 1
     * @param signerPublicKey the public key of signer
     * @param isOptinLedgerWallet if Opt-in Symbol wallet uses curve Secp256K1 else uses curve Ed25519
     * @return a signed Transaction which is signed by account at path on Ledger
     */
    public async signTransaction(
        path: string,
        transaction: LedgerTransaction,
        networkGenerationHash: string,
        signerPublicKey: string,
        isOptinLedgerWallet: boolean,
    ): Promise<{ payload: string; signature: string }> {
        const rawPayload = transaction.serialize();
        const signingBytes = networkGenerationHash + rawPayload.slice(216);
        const rawTx = Buffer.from(signingBytes, 'hex');
        const response = await this.ledgerMessageHandler(path, rawTx, false, isOptinLedgerWallet);
        // Response from Ledger
        const h = response.toString('hex');
        const signature = h.slice(0, 128);
        const payload = rawPayload.slice(0, 16) + signature + signerPublicKey + rawPayload.slice(16 + 128 + 64, rawPayload.length);
        return { payload, signature };
    }

    /**
     * it signs a Symbol Cosignature transaction with a given BIP 44 path
     *
     * @param path a path in BIP 44 format
     * @param aggregateTransaction the original aggregate transaction transaction needs to be cosigned
     * @param aggregateTransactionHash the aggregate transaction hash
     * @param signerPublicKey the public key of signer
     * @param isOptinSymbolWallet if Opt-in Symbol wallet uses curve Secp256K1 else uses curve Ed25519
     * @return a Signed Cosignature Transaction which is signed by account at path on Ledger
     */
    public async signCosignatureTransaction(
        path: string,
        aggregateTransaction: LedgerTransaction,
        aggregateTransactionHash: string,
        signerPublicKey: string,
        isOptinSymbolWallet: boolean,
    ): Promise<string> {
        const rawPayload = aggregateTransaction.serialize();
        const signingBytes = aggregateTransactionHash + rawPayload.slice(216);
        const rawTx = Buffer.from(signingBytes, 'hex');
        const response = await this.ledgerMessageHandler(path, rawTx, false, isOptinSymbolWallet);
        // Response from Ledger
        const h = response.toString('hex');
        return h.slice(0, 128);
    }

    /**
     * It closes the transport.
     */
    public async close(): Promise<void> {
        await this.transport.close();
    }

    /**
     * It handles sending and receiving packages between Ledger and Wallet
     * @param path a path in BIP 44 format
     * @param rawTx a raw payload transaction hex string
     * @param chainCode optionally enable or not the chainCode request
     * @param isOptinSymbolWallet if Opt-in Symbol wallet uses curve Secp256K1 else uses curve Ed25519
     * @returns respond package from Ledger
     */
    private async ledgerMessageHandler(path: string, rawTx: Buffer, chainCode: boolean, isOptinSymbolWallet: boolean): Promise<Buffer> {
        const TX_INS_FIELD = 0x04;
        const MAX_CHUNK_SIZE = 255;
        const CONTINUE_SENDING = '0x9000';
        const curveMask = isOptinSymbolWallet ? 0x40 : 0x80;
        const bipPath = LedgerDerivationPath.getBipPathArray(path);
        const apduArray = [];
        let offset = 0;

        while (offset !== rawTx.length) {
            const maxChunkSize = offset === 0 ? MAX_CHUNK_SIZE - 1 - bipPath.length * 4 : MAX_CHUNK_SIZE;
            const chunkSize = offset + maxChunkSize > rawTx.length ? rawTx.length - offset : maxChunkSize;
            // APDU fields configuration
            const apdu = {
                cla: CLA_FIELD,
                ins: TX_INS_FIELD,
                p1: offset === 0 ? (chunkSize < maxChunkSize ? 0x00 : 0x80) : chunkSize < maxChunkSize ? 0x01 : 0x81,
                p2: curveMask | (chainCode ? 0x01 : 0x00),
                data: offset === 0 ? Buffer.alloc(1 + bipPath.length * 4 + chunkSize) : Buffer.alloc(chunkSize),
            };

            if (offset === 0) {
                apdu.data.writeInt8(bipPath.length, 0);
                bipPath.forEach((segment: number, index: number) => {
                    apdu.data.writeUInt32BE(segment, 1 + index * 4);
                });
                rawTx.copy(apdu.data, 1 + bipPath.length * 4, offset, offset + chunkSize);
            } else {
                rawTx.copy(apdu.data, 0, offset, offset + chunkSize);
            }
            apduArray.push(apdu);
            offset += chunkSize;
        }
        let response = Buffer.alloc(0);
        for (const apdu of apduArray) {
            response = await this.sendPackage(apdu);
        }

        if (response.toString() != CONTINUE_SENDING) {
            return response;
        } else {
            throw new Error(`${response.toString()} should not be ${CONTINUE_SENDING}`);
        }
    }

    private sendPackage(apdu: ApduPackage): Promise<Buffer> {
        return this.transport.send(apdu.cla, apdu.ins, apdu.p1, apdu.p2, apdu.data);
    }
}
