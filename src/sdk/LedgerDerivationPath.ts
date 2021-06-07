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
// internal dependencies
// @ts-ignore
import * as BIPPath from 'bip32-path';
import { LedgerNetworkType } from './LedgerNetworkType';

/**
 * Utility object to calculate symbols's derivation paths.
 */
export class LedgerDerivationPath {
    /**
     * Returns if the value is a valid derivation path according to the provided network type.
     * @param value the path
     * @param networkType the network type
     */
    public static isValid(value: string, networkType: LedgerNetworkType): boolean {
        const coinIndex = networkType === LedgerNetworkType.MAIN_NET ? '4343' : '1';
        return !!value.match("^m/44'/" + coinIndex + "'/[0-9]+'/[0-9]+'/[0-9]+'");
    }

    /**
     * Generates a path according to the network type and the provided indexes
     * @param networkType the network type.
     * @param accountIndex the account index.
     * @param changeIndex the change index
     * @param addressIndex the address index.
     */
    public static getPath(networkType: LedgerNetworkType, accountIndex = 0, changeIndex = 0, addressIndex = 0): string {
        const coinIndex = networkType === LedgerNetworkType.MAIN_NET ? '4343' : '1';
        return `m/44'/${coinIndex}'/${accountIndex}'/${changeIndex}'/${addressIndex}'`;
    }

    /**
     * TODO change the implementation to a typescript friendly one.
     * @param path the path string.
     * @return the number array representation of the path.
     */
    public static getBipPathArray(path: string): number[] {
        return BIPPath.fromString(path).toPathArray();
    }
}
