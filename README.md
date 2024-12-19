# Derion SDK

## Sample Usage
```js
const sdk = new DerionSdk({ chainId: 42161 })
await sdk.init()

const stateLoader = sdk.getStateLoader({ rpcURL })
const account = sdk.createAccount(address)

let txLogs: LogType[][] = []
if ("we have account logs from some indexer or etherscan") {
    txLogs = groupBy(logs, log => log.transactionHash)
} else if ("we have receipts from some indexer") {
    txLogs = receipts.map(r => r.logs)
}

const poolCreationLogs = [...]
const knownPoolAddresses = [...]
const pools = {}
poolCreationLogs.forEach(log => {
    // create pool configs from log
    const pool = sdk.createPool(log)
    pools[pool.address] = pool
})
if ("we want to extract pools that interacted by the logs") {
    knownPoolAddresses.push(...sdk.extractPoolAddresses(txLogs))
}
if (knownPoolAddresses.length) {
    // load pool configs from addresses
    const _pools = await stateLoader.loadPools(knownPoolAddresses)
    for (const pool of _pools) {
        pools[pool.address] = pool
    }
}

// build the historical data (incrementally)
// Notes: does this for every new logs acchieved
account.processLogs(txLogs, pools)

// account transaction history can be build from account.transistions
const txHistory = account.transistions

const knownPositionIds = [...]
for (const id of knownPositionIds) {
    // create an empty position without any historical entry
    const [poolAddress, side] = sdk.unpackId(id)
    account.importPosition(pools[poolAddress], side)
}
for (const entry of account.entries) {
    // create an empty position with its entry
    account.importPosition(pools[poolAddress], entry)
}

const accounts = {
    [account.address]: account,
}

// update pools and positions state and balance
// Note: does this as often as we can afford
await stateLoader.update({ pools, accounts })

const swapper = sdk.getSwapper({ utr, aggApi })
const { amountOut, gasUsed } = await swapper.simulate(params: { tokenIn, tokenOut, amount }, deps: { pools, account })
const tx = await swapper.swap(params: { tokenIn, tokenOut, amount }, deps: { pools, signer })
```

## Public Configs
Public configuration for Derion is loaded from `https://github.com/derion-io/configs`

## SDK Objects

### SDK

Hold the public configs and its component, no state nor historical data is stored in this object.

The SDK object is used to created and load other types of object below.

```js
sdk = new DerionSdk({ chainId: 42161 })
await sdk.init()
```

### StateLoader

Povides the logic for on-chain data loading, usually for multiple data at a time using `ethereum-multicall`.

```js
stateLoader = sdk.getStateLoader({ rpcURL })
```

### Pool

Represents each Derion pool, can be created using creation log (with no event signature) from PoolDeployer with:
   * topic0: baseToken address
   * topic1: baseToken symbol
   * topic2: search keyword 1
   * topic3: search keyword 2
   * data: pool configs followed by pool address
   * e.g. https://polygonscan.com/tx/0x6ccfc6af4b472e3d64ee82ca9b4dec6a671b41107fae772206a24e50fc55bdc7#eventlog#70

```js
poolA = sdk.createPool(log)
```

Alternatively, pool can be created by loading from the chain state by passing pool addresses to `StateLoader`:

```js
[poolB, poolC] = await stateLoader.loadPools([addressB, addressC], withState = false)
```

Current state of pool is loadded using StateLoader:

```js
pools = [poolA, poolB, poolC]
stateLoader.update({ pools, accounts }) // mass update state for multiple pools
```

### Account

Represents an account with an address to call and send transaction.

```js
account = sdk.createAccount(address | Signer)
```

## Position Historical Data

Position entry data and transitions are historical data of an unique position (a Derion token in an account). They require event logs to construct, these logs can be obtained by 3rd-party indexer (e.g. etherscan) or in-house indexing service. Without these logs, client can only have knownledge about the current state of a position, not the entry and transistion data.

```js
account.processLogs(
    txLogs: LogType[][],
    pools?: { [address]: pool },
)
```

The results are stored (and updated) in `account.entries` and `account.transistions`.

`txLogs` is a 2 dimentional array logs grouped by `transactionHash` of the following events:
* Pool.Position
* Helper.Swap
* Token.TransferSingle
* Token.TransferBatch
* ERC20.Transfer

```js
txLogs = [
    [log, log, log, ...], // all related logs of the same tx
    [log, log, ...],
    [log, log, ...],
    ...
]
```

## Position

```js
account.importPosition(pool, side)    // create an empty position without any historical entry
account.importPosition(pool, entry)   // create and empty position with its entry
await stateLoader.update({ positions, accounts }) // load positions state and balance
```

## Swapper

```js
swapper = sdk.getSwapper({ utr, aggApi })
{ amountOut, gasUsed } = swapper.simulate(params: { tokenIn, tokenOut, amount }, deps: { pools, account })
swapper.swap(params: { tokenIn, tokenOut, amount }, deps: { pools, signer })
```
