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
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
// @ts-ignore
import SpeculosTransport from '@ledgerhq/hw-transport-node-speculos';
import { expect } from 'chai';
import 'mocha';
import {
    Address,
    AggregateTransaction,
    Convert,
    Deadline,
    KeyPair,
    NetworkCurrencies,
    NetworkType,
    PlainMessage,
    PublicAccount,
    Transaction,
    TransferTransaction,
    UInt64,
} from 'symbol-sdk';
import { AppVersion, LedgerDerivationPath, LedgerNetworkType, SymbolLedger } from '../src';

describe('SymbolLedger', () => {
    function createTransport(): Promise<Transport> {
        const useRealDevice = true;
        console.log(`Connecting to ${useRealDevice ? 'Real' : 'Simulated'} Ledger`);
        return useRealDevice ? TransportNodeHid.create(5000, 5000) : SpeculosTransport.open({ apduPort: 9999 });
    }

    const deadline = Deadline.createFromDTO('1000');
    const generationHash = '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155';

    it('basic connect example', async () => {
        const transport = await createTransport();
        console.log(`Connecting to ledger 2`);
        let ledger: SymbolLedger | undefined;
        try {
            let appVersion: AppVersion;
            try {
                ledger = new SymbolLedger(transport, 'XYM');
                appVersion = await ledger.getAppVersion();
            } catch (e) {
                throw new Error(
                    `It seems the device hasn't been connected yet. Have you unlocked your device and open then Symbol App?. Error ${e}`,
                );
            }
            const expectedAppVersion = ledger.getExpectedAppVersion();
            function printVersion(appVersion: AppVersion) {
                return `v${appVersion.majorVersion}.${appVersion.minorVersion}.${appVersion.patchVersion}`;
            }
            console.log(`Symbol App version is ${printVersion(appVersion)}`);
            if (!ledger.isVersionSupported(appVersion, expectedAppVersion)) {
                throw new Error(
                    `The current Symbol Application ${printVersion(
                        appVersion,
                    )} is not supported. Expected version is at least ${printVersion(
                        expectedAppVersion,
                    )}. Install latest Symbol App via Ledger Live`,
                );
            }
        } finally {
            await ledger?.close();
        }
    });

    it('getAppVersion', async () => {
        const transport = await createTransport();
        try {
            const ledger = new SymbolLedger(transport, 'XYM');
            const appVersion = await ledger.getAppVersion();
            expect(appVersion).deep.eq({ majorVersion: 1, minorVersion: 0, patchVersion: 2 });
        } finally {
            await transport.close();
        }
    });

    it('check version example', async () => {
        const transport = await createTransport();
        try {
            const ledger = new SymbolLedger(transport, 'XYM');
            const appVersion = await ledger.getAppVersion();
            expect(appVersion).deep.eq({ majorVersion: 1, minorVersion: 0, patchVersion: 2 });
        } finally {
            await transport.close();
        }
    });

    it('get one account example', async () => {
        const transport = await createTransport();
        const ledger = new SymbolLedger(transport, 'XYM');
        try {
            const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
            const networkType = ledgerNetworkType as number as NetworkType;
            const path = LedgerDerivationPath.getPath(ledgerNetworkType, 0, 0);
            const publicKey = await ledger.getAccount(path, ledgerNetworkType, false, false, false);
            console.log(`${path}: ${Address.createFromPublicKey(publicKey, networkType).plain()}`);
        } finally {
            await ledger.close();
        }
    });

    it('get multiple accounts with different account index example', async () => {
        const transport = await createTransport();
        const ledger = new SymbolLedger(transport, 'XYM');
        try {
            const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
            const networkType = ledgerNetworkType as number as NetworkType;
            for (const accountIndex of Array.from(Array(10).keys())) {
                const path = LedgerDerivationPath.getPath(ledgerNetworkType, accountIndex);
                const publicKey = await ledger.getAccount(path, ledgerNetworkType, false, false, false);
                console.log(`${path}: ${Address.createFromPublicKey(publicKey, networkType).plain()}`);
            }
        } finally {
            await ledger.close();
        }
    });

    async function createTransferTransaction(ledgerNetworkType: LedgerNetworkType, networkType: NetworkType) {
        const recipientPublicKey = 'A20E64A3324FD7542FA6BAA34FFD86B547DA52F27BE8E6392838EA1466F19566';
        const maxFee = UInt64.fromUint(1220000);
        const mosaic = NetworkCurrencies.PUBLIC.currency.createRelative(100);
        return TransferTransaction.create(
            deadline,
            Address.createFromPublicKey(recipientPublicKey, networkType),
            [mosaic],
            PlainMessage.create('test-message'),
            networkType,
            maxFee,
        );
    }

    const verifySignature = (publicKey: string, data: string, signature: string): boolean => {
        return KeyPair.verify(Convert.hexToUint8(publicKey), Convert.hexToUint8(data), Convert.hexToUint8(signature));
    };

    it('signTransaction example', async () => {
        const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
        const networkType = ledgerNetworkType as number as NetworkType;
        const generationHashBytes = Array.from(Convert.hexToUint8(generationHash));
        const transferTransaction = await createTransferTransaction(ledgerNetworkType, networkType);
        const payloadBytes = Array.from(Convert.hexToUint8(transferTransaction.serialize()));
        const signingBytes = transferTransaction.getSigningBytes(payloadBytes, generationHashBytes);
        const transport = await createTransport();
        const ledger = new SymbolLedger(transport, 'XYM');
        try {
            const path = LedgerDerivationPath.getPath(ledgerNetworkType, 0, 0);
            const publicKey = await ledger.getAccount(path, ledgerNetworkType, false, false, false);
            console.log('Signing transaction. CHECK YOUR LEDGER!');
            const { signature } = await ledger.signTransaction(path, transferTransaction, generationHash, publicKey, false);
            expect(verifySignature(publicKey, Convert.uint8ToHex(signingBytes), signature)).to.be.true;
        } finally {
            await ledger.close();
        }
    });

    it('signCosignatureTransaction normal aggregate example', async () => {
        const transport = await createTransport();
        try {
            const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
            const ledger = new SymbolLedger(transport, 'XYM');
            const path = LedgerDerivationPath.getPath(ledgerNetworkType, 0, 0);
            const publicKey = await ledger.getAccount(path, ledgerNetworkType, false, false, false);
            const networkType = ledgerNetworkType as number as NetworkType;
            const transferTransaction = await createTransferTransaction(ledgerNetworkType, networkType);
            const ledgerPublicAccount = PublicAccount.createFromPublicKey(publicKey, networkType);
            //up to 3 transfer transactions.
            const fullAggregate = AggregateTransaction.createBonded(
                deadline,
                Array.from(Array(3).keys()).map(() => transferTransaction.toAggregate(ledgerPublicAccount)),
                networkType,
                [],
                UInt64.fromUint(120000),
            );
            const fullPayload = fullAggregate.serialize();
            const transactionHash = Transaction.createTransactionHash(fullPayload, Array.from(Convert.hexToUint8(generationHash)));

            console.log('Signing transaction. CHECK YOUR LEDGER!');
            const signature = await ledger.signCosignatureTransaction(path, fullAggregate, transactionHash, publicKey, false);
            expect(verifySignature(publicKey, transactionHash, signature)).to.be.true;
        } finally {
            await transport.close();
        }
    });

    it('signCosignatureTransaction large payloads, faking message example', async () => {
        const transport = await createTransport();
        try {
            const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
            const ledger = new SymbolLedger(transport, 'XYM');
            const path = LedgerDerivationPath.getPath(ledgerNetworkType, 0, 0);
            const publicKey = await ledger.getAccount(path, ledgerNetworkType, false, false, false);
            const networkType = ledgerNetworkType as number as NetworkType;
            const transferTransaction = await createTransferTransaction(ledgerNetworkType, networkType);
            const ledgerPublicAccount = PublicAccount.createFromPublicKey(publicKey, networkType);
            //lots of transfer transactions. Too many for ledger.
            const fullAggregate = AggregateTransaction.createBonded(
                deadline,
                Array.from(Array(10).keys()).map(() => transferTransaction.toAggregate(ledgerPublicAccount)),
                networkType,
                [],
                UInt64.fromUint(120000),
            );
            const fullPayload = fullAggregate.serialize();
            const transactionHash = Transaction.createTransactionHash(fullPayload, Array.from(Convert.hexToUint8(generationHash)));

            const fakeTransferTransaction = TransferTransaction.create(
                deadline,
                Address.createFromPublicKey(fullAggregate.innerTransactions[0].signer!.publicKey, networkType),
                [],
                PlainMessage.create(
                    `This is an incomplete aggregate. To see the full transaction check out the explorer. Transaction hash ${transactionHash}`,
                ),
                networkType,
            );
            const incompleteAggregate = AggregateTransaction.createBonded(deadline, [fakeTransferTransaction], networkType, []);

            console.log('Signing transaction. CHECK YOUR LEDGER!');
            const signature = await ledger.signCosignatureTransaction(path, incompleteAggregate, transactionHash, publicKey, false);
            expect(verifySignature(publicKey, transactionHash, signature)).to.be.true;
        } finally {
            await transport.close();
        }
    });
});
