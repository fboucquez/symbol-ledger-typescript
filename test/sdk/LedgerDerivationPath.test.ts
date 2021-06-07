import { expect } from 'chai';
import { describe, it } from 'mocha';
import { LedgerDerivationPath, LedgerNetworkType } from '../../src/sdk';

describe('LedgerDerivationPath', () => {
    it('should be valid path', () => {
        expect(LedgerDerivationPath.isValid(LedgerDerivationPath.getPath(LedgerNetworkType.MAIN_NET, 0, 0), LedgerNetworkType.MAIN_NET)).eq(
            true,
        );
        expect(LedgerDerivationPath.isValid(LedgerDerivationPath.getPath(LedgerNetworkType.TEST_NET, 1, 0), LedgerNetworkType.TEST_NET)).eq(
            true,
        );
        expect(LedgerDerivationPath.isValid(LedgerDerivationPath.getPath(LedgerNetworkType.TEST_NET, 0, 0), LedgerNetworkType.MAIN_NET)).eq(
            false,
        );
        expect(LedgerDerivationPath.isValid(LedgerDerivationPath.getPath(LedgerNetworkType.MAIN_NET, 0, 0), LedgerNetworkType.TEST_NET)).eq(
            false,
        );
        expect(LedgerDerivationPath.isValid(' nop', LedgerNetworkType.TEST_NET)).eq(false);
    });

    it('should getPath', () => {
        expect(LedgerDerivationPath.getPath(LedgerNetworkType.MAIN_NET, 0, 0)).eq("m/44'/4343'/0'/0'/0'");
        expect(LedgerDerivationPath.getPath(LedgerNetworkType.TEST_NET, 1, 0)).eq("m/44'/1'/1'/0'/0'");
        expect(LedgerDerivationPath.getPath(LedgerNetworkType.TEST_NET, 3, 2)).eq("m/44'/1'/3'/2'/0'");
        expect(LedgerDerivationPath.getPath(LedgerNetworkType.MAIN_NET, 4, 3)).eq("m/44'/4343'/4'/3'/0'");
    });

    it('should getPath', () => {
        expect(LedgerDerivationPath.getBipPathArray("m/44'/1'/0'/0'/0'")).deep.eq([
            2147483692, 2147483649, 2147483648, 2147483648, 2147483648,
        ]);
        expect(LedgerDerivationPath.getBipPathArray("m/44'/4343'/0'/0'/0'")).deep.eq([
            2147483692, 2147487991, 2147483648, 2147483648, 2147483648,
        ]);
        expect(LedgerDerivationPath.getBipPathArray("m/44'/4343'/0'/1'/0'")).deep.eq([
            2147483692, 2147487991, 2147483648, 2147483649, 2147483648,
        ]);
        expect(LedgerDerivationPath.getBipPathArray("m/44'/1'/0'/2'/0'")).deep.eq([
            2147483692, 2147483649, 2147483648, 2147483650, 2147483648,
        ]);
        expect(LedgerDerivationPath.getBipPathArray("m/44'/4343'/2'/3'/4'")).deep.eq([
            2147483692, 2147487991, 2147483650, 2147483651, 2147483652,
        ]);
        expect(LedgerDerivationPath.getBipPathArray("m/22'/33'/2'/3'/4'")).deep.eq([
            2147483670, 2147483681, 2147483650, 2147483651, 2147483652,
        ]);
        expect(() => LedgerDerivationPath.getBipPathArray('invalid')).throw;
    });
});
