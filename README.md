# Derion SDK

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
[poolB, poolC] = await stateLoader.createPools([addressB, addressC], withState = false)
```

Current state of pool is loadded using StateLoader:

```js
pools = [poolA, poolB, poolC]
stateLoader.loadPools(pools) // mass update state for multiple pools
```

### Account

Represents an account with an address to call and send transaction.

```js
account = sdk.createAccount(address | Signer)
```

## Position Historical Data

Position entry data and transitions are historical data of an unique position (a Derion token in an account). They require event logs to construct, these logs can be obtained by 3rd-party indexer (e.g. etherscan) or in-house indexing service. Without these logs, client can only have knownledge about the current state of a position, not the entry and transistion data.

```js
{ entries, transitions } = account.processLogs(txLogs, pools)
```

`txLogs` is a 2 dimentional array logs grouped by `transactionHash` of the following events:
* Pool.Position
* Helper.Swap
* Token.TransferSingle
* Token.TransferBatch
* ERC20.Transfer

```js
txLogs = [
    [log, log, log], // all related logs of the same tx
    [log, log],
    [log, log, ...],
]
```

## Position

```js
position = pool.createPosition(id)          // create position without any historical entry
position = pool.createPosition(entry)       // create position with its entry
await stateLoader.update({ positions })     // load positions state and balance
```

## Swapper

```js
swapper = sdk.getSwapper({ utr, aggApi })
{ amountOut, gasUsed } = swapper.simulate(params: { tokenIn, tokenOut, amount }, deps: { pools, account })
swapper.swap(params: { tokenIn, tokenOut, amount }, deps: { pools, signer })
```
