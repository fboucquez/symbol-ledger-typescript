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
import { expect } from 'chai';
import 'mocha';
import {
    Address,
    AggregateTransaction,
    Convert,
    Deadline,
    NetworkCurrencies,
    NetworkType,
    PlainMessage,
    PublicAccount,
    Transaction,
    TransferTransaction,
    UInt64,
} from 'symbol-sdk';
import { deepEqual, instance, mock, when } from 'ts-mockito';
import { ApduPackage, LedgerDerivationPath, LedgerNetworkType, SymbolLedger } from '../src';

describe('SymbolLedger', () => {
    it('isVersionSupported', async () => {
        const transport: Transport = mock(Transport);
        const ledger = new SymbolLedger(instance(transport), 'XYM');
        expect(
            ledger.isVersionSupported(
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
            ),
        ).to.be.true;

        expect(
            ledger.isVersionSupported(
                { majorVersion: 1, minorVersion: 0, patchVersion: 3 },
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
            ),
        ).to.be.true;

        expect(
            ledger.isVersionSupported(
                { majorVersion: 1, minorVersion: 1, patchVersion: 2 },
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
            ),
        ).to.be.true;
        expect(
            ledger.isVersionSupported(
                { majorVersion: 2, minorVersion: 0, patchVersion: 2 },
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
            ),
        ).to.be.true;

        expect(
            ledger.isVersionSupported(
                { majorVersion: 1, minorVersion: 0, patchVersion: 1 },
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
            ),
        ).to.be.false;

        expect(
            ledger.isVersionSupported(
                { majorVersion: 0, minorVersion: 0, patchVersion: 3 },
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
            ),
        ).to.be.false;

        expect(
            ledger.isVersionSupported(
                { majorVersion: 0, minorVersion: 9, patchVersion: 1 },
                { majorVersion: 1, minorVersion: 0, patchVersion: 2 },
            ),
        ).to.be.false;
    });

    const mockCall = (transport: Transport, apdu: ApduPackage, responseHex: string): void => {
        when(transport.send(apdu.cla, apdu.ins, apdu.p1, apdu.p2, deepEqual(apdu.data))).thenResolve(Buffer.from(responseHex, 'hex'));
    };

    it('getAppVersion', async () => {
        const transport: Transport = mock(Transport);
        mockCall(transport, { cla: 224, ins: 6, p1: 0, p2: 0, data: Buffer.alloc(1) }, '000100029000');
        const ledger = new SymbolLedger(instance(transport), 'XYM');
        expect(await ledger.getAppVersion()).to.be.deep.eq({ majorVersion: 1, minorVersion: 0, patchVersion: 2 });
    });

    it('getAccount', async () => {
        const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
        const networkType = ledgerNetworkType as number as NetworkType;

        const path = LedgerDerivationPath.getPath(ledgerNetworkType, 0, 0);
        const transport: Transport = mock(Transport);
        mockCall(
            transport,
            {
                cla: 224,
                ins: 2,
                p1: 0,
                p2: 128,
                data: Buffer.from([5, 128, 0, 0, 44, 128, 0, 16, 247, 128, 0, 0, 0, 128, 0, 0, 0, 128, 0, 0, 0, 104]),
            },
            '204c1c263b986eebc681bb95cbd5812a7fa0530472e1e90b299c026d31792efaaa9000',
        );
        const ledger = new SymbolLedger(instance(transport), 'XYM');
        const publicKey = '4c1c263b986eebc681bb95cbd5812a7fa0530472e1e90b299c026d31792efaaa';
        expect(await ledger.getAccount(path, ledgerNetworkType, false, false, false)).to.be.deep.eq(publicKey);
        expect(Address.createFromPublicKey(publicKey, networkType).plain()).eq('NBFALEF55PEYTJWJUG373HVHGE7Y3YBW7PBPECQ');
    });

    const deadline = Deadline.createFromDTO('1000');
    const generationHash = '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155';
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

    it('signTransaction', async () => {
        const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
        const networkType = ledgerNetworkType as number as NetworkType;
        const transferTransaction = await createTransferTransaction(ledgerNetworkType, networkType);
        const transport: Transport = mock(Transport);

        mockCall(
            transport,
            {
                cla: 224,
                ins: 4,
                p1: 0,
                p2: 128,
                data: Buffer.from([
                    5, 128, 0, 0, 44, 128, 0, 16, 247, 128, 0, 0, 0, 128, 0, 0, 0, 128, 0, 0, 0, 59, 94, 31, 166, 68, 86, 83, 201, 113, 165,
                    6, 135, 231, 94, 109, 9, 251, 48, 72, 16, 85, 227, 153, 12, 132, 178, 94, 146, 34, 220, 17, 85, 1, 104, 84, 65, 160,
                    157, 18, 0, 0, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0, 104, 10, 200, 37, 95, 236, 138, 77, 58, 205, 200, 101, 224, 60, 252,
                    210, 98, 17, 44, 101, 143, 7, 39, 134, 13, 0, 1, 0, 0, 0, 0, 0, 238, 175, 244, 65, 186, 153, 75, 231, 0, 225, 245, 5, 0,
                    0, 0, 0, 0, 116, 101, 115, 116, 45, 109, 101, 115, 115, 97, 103, 101,
                ]),
            },
            'c1210aa01f3cad1911c1874d53b73660840357ca50665ee949712d74ed307f660d790b33487743029e9a6bbaf89e02e787b0233bf9346e94f1f617a46a86ca089000',
        );
        const ledger = new SymbolLedger(instance(transport), 'XYM');

        const path = LedgerDerivationPath.getPath(ledgerNetworkType, 0, 0);
        const publicKey = '4c1c263b986eebc681bb95cbd5812a7fa0530472e1e90b299c026d31792ef97e';
        const { signature, payload } = await ledger.signTransaction(path, transferTransaction, generationHash, publicKey, false);
        expect(signature).eq(
            'c1210aa01f3cad1911c1874d53b73660840357ca50665ee949712d74ed307f660d790b33487743029e9a6bbaf89e02e787b0233bf9346e94f1f617a46a86ca08',
        );
        expect(payload).eq(
            'BD00000000000000c1210aa01f3cad1911c1874d53b73660840357ca50665ee949712d74ed307f660d790b33487743029e9a6bbaf89e02e787b0233bf9346e94f1f617a46a86ca084c1c263b986eebc681bb95cbd5812a7fa0530472e1e90b299c026d31792ef97e0000000001685441A09D120000000000E803000000000000680AC8255FEC8A4D3ACDC865E03CFCD262112C658F0727860D00010000000000EEAFF441BA994BE700E1F5050000000000746573742D6D657373616765',
        );
    });

    it('signCosignatureTransaction normal aggregate', async () => {
        const transport: Transport = mock(Transport);
        const value = {
            cla: 224,
            ins: 4,
            p1: 128,
            p2: 128,
            data: {
                type: 'Buffer',
                data: [
                    5, 128, 0, 0, 44, 128, 0, 16, 247, 128, 0, 0, 0, 128, 0, 0, 0, 128, 0, 0, 0, 148, 246, 172, 151, 116, 139, 150, 233,
                    179, 55, 225, 23, 236, 33, 139, 220, 240, 47, 190, 150, 243, 129, 29, 188, 196, 150, 208, 210, 13, 61, 24, 242, 1, 104,
                    65, 66, 192, 212, 1, 0, 0, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0, 14, 129, 73, 205, 202, 5, 226, 164, 56, 27, 248, 141, 184,
                    35, 203, 211, 127, 86, 244, 145, 50, 241, 130, 237, 74, 63, 247, 10, 232, 171, 46, 201, 80, 1, 0, 0, 0, 0, 0, 0, 109, 0,
                    0, 0, 0, 0, 0, 0, 76, 28, 38, 59, 152, 110, 235, 198, 129, 187, 149, 203, 213, 129, 42, 127, 160, 83, 4, 114, 225, 233,
                    11, 41, 156, 2, 109, 49, 121, 46, 249, 126, 0, 0, 0, 0, 1, 104, 84, 65, 104, 10, 200, 37, 95, 236, 138, 77, 58, 205,
                    200, 101, 224, 60, 252, 210, 98, 17, 44, 101, 143, 7, 39, 134, 13, 0, 1, 0, 0, 0, 0, 0, 238, 175, 244, 65, 186, 153, 75,
                    231, 0, 225, 245, 5, 0, 0, 0, 0, 0, 116, 101, 115, 116, 45, 109, 101, 115, 115, 97, 103, 101, 0, 0, 0, 109, 0, 0, 0, 0,
                    0, 0, 0, 76, 28, 38, 59, 152, 110, 235, 198, 129, 187, 149, 203, 213, 129, 42, 127, 160, 83, 4, 114, 225, 233,
                ],
            },
        };

        mockCall(
            transport,
            {
                cla: 224,
                ins: 4,
                p1: 128,
                p2: 128,
                data: Buffer.from([
                    5, 128, 0, 0, 44, 128, 0, 16, 247, 128, 0, 0, 0, 128, 0, 0, 0, 128, 0, 0, 0, 148, 246, 172, 151, 116, 139, 150, 233,
                    179, 55, 225, 23, 236, 33, 139, 220, 240, 47, 190, 150, 243, 129, 29, 188, 196, 150, 208, 210, 13, 61, 24, 242, 1, 104,
                    65, 66, 192, 212, 1, 0, 0, 0, 0, 0, 232, 3, 0, 0, 0, 0, 0, 0, 14, 129, 73, 205, 202, 5, 226, 164, 56, 27, 248, 141, 184,
                    35, 203, 211, 127, 86, 244, 145, 50, 241, 130, 237, 74, 63, 247, 10, 232, 171, 46, 201, 80, 1, 0, 0, 0, 0, 0, 0, 109, 0,
                    0, 0, 0, 0, 0, 0, 76, 28, 38, 59, 152, 110, 235, 198, 129, 187, 149, 203, 213, 129, 42, 127, 160, 83, 4, 114, 225, 233,
                    11, 41, 156, 2, 109, 49, 121, 46, 249, 126, 0, 0, 0, 0, 1, 104, 84, 65, 104, 10, 200, 37, 95, 236, 138, 77, 58, 205,
                    200, 101, 224, 60, 252, 210, 98, 17, 44, 101, 143, 7, 39, 134, 13, 0, 1, 0, 0, 0, 0, 0, 238, 175, 244, 65, 186, 153, 75,
                    231, 0, 225, 245, 5, 0, 0, 0, 0, 0, 116, 101, 115, 116, 45, 109, 101, 115, 115, 97, 103, 101, 0, 0, 0, 109, 0, 0, 0, 0,
                    0, 0, 0, 76, 28, 38, 59, 152, 110, 235, 198, 129, 187, 149, 203, 213, 129, 42, 127, 160, 83, 4, 114, 225, 233,
                ]),
            },
            '9000',
        );

        mockCall(
            transport,
            {
                cla: 224,
                ins: 4,
                p1: 1,
                p2: 128,
                data: Buffer.from([
                    11, 41, 156, 2, 109, 49, 121, 46, 249, 126, 0, 0, 0, 0, 1, 104, 84, 65, 104, 10, 200, 37, 95, 236, 138, 77, 58, 205,
                    200, 101, 224, 60, 252, 210, 98, 17, 44, 101, 143, 7, 39, 134, 13, 0, 1, 0, 0, 0, 0, 0, 238, 175, 244, 65, 186, 153, 75,
                    231, 0, 225, 245, 5, 0, 0, 0, 0, 0, 116, 101, 115, 116, 45, 109, 101, 115, 115, 97, 103, 101, 0, 0, 0, 109, 0, 0, 0, 0,
                    0, 0, 0, 76, 28, 38, 59, 152, 110, 235, 198, 129, 187, 149, 203, 213, 129, 42, 127, 160, 83, 4, 114, 225, 233, 11, 41,
                    156, 2, 109, 49, 121, 46, 249, 126, 0, 0, 0, 0, 1, 104, 84, 65, 104, 10, 200, 37, 95, 236, 138, 77, 58, 205, 200, 101,
                    224, 60, 252, 210, 98, 17, 44, 101, 143, 7, 39, 134, 13, 0, 1, 0, 0, 0, 0, 0, 238, 175, 244, 65, 186, 153, 75, 231, 0,
                    225, 245, 5, 0, 0, 0, 0, 0, 116, 101, 115, 116, 45, 109, 101, 115, 115, 97, 103, 101, 0, 0, 0,
                ]),
            },
            'd0da1f575093dc92ba73ef9274fb61f73668bcfc823d65c5736dccf6acf62e314467bf9f53e5e5a48d59e0f2b053d7375d3376ae0ac7200dd74d3c7c2836cd0e9000',
        );

        const ledgerNetworkType = LedgerNetworkType.MAIN_NET;
        const ledger = new SymbolLedger(instance(transport), 'XYM');
        const path = LedgerDerivationPath.getPath(ledgerNetworkType, 0, 0);
        const publicKey = '4c1c263b986eebc681bb95cbd5812a7fa0530472e1e90b299c026d31792ef97e';
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

        const signature = await ledger.signCosignatureTransaction(path, fullAggregate, transactionHash, publicKey, false);
        expect(signature).eq(
            'd0da1f575093dc92ba73ef9274fb61f73668bcfc823d65c5736dccf6acf62e314467bf9f53e5e5a48d59e0f2b053d7375d3376ae0ac7200dd74d3c7c2836cd0e',
        );
    });
});
