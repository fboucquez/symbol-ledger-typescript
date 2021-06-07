# symbol-ledger-typescript

Small client library that provides a facade between javascript and typescript apps and the [Symbol Ledger App](https://github.com/nemgrouplimited/symbol-ledger-app) in a [Ledger](https://ledger.readthedocs.io/en/latest).

[![Version](https://img.shields.io/npm/v/symbol-ledger-typescript.svg)](https://npmjs.org/package/symbol-ledger-typescript)
[![Downloads/week](https://img.shields.io/npm/dw/symbol-ledger-typescript.svg)](https://npmjs.org/package/symbol-ledger-typescript)
[![License](https://img.shields.io/npm/l/symbol-ledger-typescript.svg)](https://github.com/fboucquez/symbol-ledger-typescript/blob/master/package.json)
[![Build Status](https://travis-ci.com/fboucquez/symbol-ledger-typescript.svg?branch=main)](https://travis-ci.com/fboucquez/symbol-ledger-typescript)
[![Coverage Status](https://coveralls.io/repos/github/fboucquez/symbol-ledger-typescript/badge.svg?branch=main)](https://coveralls.io/github/fboucquez/symbol-ledger-typescript?branch=main)
[![Api Doc](https://img.shields.io/badge/api-doc-blue.svg)](https://fboucquez.github.io/symbol-ledger-typescript/)

To keep the library small and (release) independent, the library doesn't depend on the typescript SDK, but it should be used alongside.
The library tests use the TS SDK for e2e and demonstration propuses.

To try the library:

1. Connect your Ledger device to your computer.
2. Using Ledger Live, install the Symbol App.
3. Open the Symbol Ledger App in your Ledger device.
4. Clone this repo.
5. `npm install`
6. `npm run e2e`

You can see usage examples in the [SymbolLedger.e2e.ts](https://github.com/fboucquez/symbol-ledger-typescript/blob/main/test/SymbolLedger.e2e.ts) file.
