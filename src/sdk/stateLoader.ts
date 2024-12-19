import { JsonRpcProvider, Networkish } from '@ethersproject/providers'
import { CallReturnContext, ContractCallContext, Multicall } from 'ethereum-multicall';
import { ConnectionInfo } from 'ethers/lib/utils';
import { Profile } from '../profile';
import { DerionPoolConfigs } from "../types"
import { BigNumber } from 'ethers';

export class StateLoader {
  profile: Profile
  provider: JsonRpcProvider
  mc: Multicall

  constructor(profile: Profile, url?: ConnectionInfo | string, network?: Networkish) {
    this.profile = profile
    this.provider = new JsonRpcProvider(url, network)
    this.mc = new Multicall({ ethersProvider: this.provider, tryAggregate: true });
  }

  async loadPools(addresses: string[]): Promise<DerionPoolConfigs> {
    const { abi } = this.profile.getAbi('View')
    const pools: DerionPoolConfigs = {}
    await this._multicall(addresses.map(poolAddress => ({
      reference: poolAddress,
      contractAddress: poolAddress,
      abi,
      calls: [{
        reference: 'loadConfig',
        methodName: "loadConfig",
        methodParameters: [],
      }],
      context: (callsReturnContext: CallReturnContext[]) => {
        for (const ret of callsReturnContext) {
          const [
            FETCHER, ORACLE, TOKEN_R, K, MARK, INTEREST_HL, PREMIUM_HL, MATURITY, MATURITY_VEST, MATURITY_RATE, OPEN_RATE
          ] = ret.returnValues.map(v => v.type == 'BigNumber' ? BigNumber.from(v.hex) : v)
          pools[poolAddress] = {
            address: poolAddress,
            FETCHER,
            ORACLE,
            TOKEN_R,
            K: K.toNumber(),
            MARK,
            INTEREST_HL: INTEREST_HL.toNumber(),
            PREMIUM_HL: PREMIUM_HL.toNumber(),
            MATURITY: MATURITY.toNumber(),
            MATURITY_VEST: MATURITY_VEST.toNumber(),
            MATURITY_RATE,
            OPEN_RATE,
          }
        }
        return callsReturnContext
      },
    })))
    return pools
  }

  async update({
    pools,
  }: {
    pools?: DerionPoolConfigs,
  }) {
    const { abi, deployedBytecode: code } = this.profile.getAbi('View')
    this.provider.setStateOverride({
      [this.profile.configs.derivable.logic]: { code },
    })
    await this._multicall(Object.values(pools ?? {}).map(pool => ({
      reference: pool.address,
      contractAddress: pool.address,
      abi,
      calls: [{
        reference: 'compute',
        methodName: "compute",
        methodParameters: [
          this.profile.configs.derivable.token,
          this.profile.configs.derivable.feeRate ?? 5,
          0, 0, // twap and spot
        ],
      }],
      context: (callsReturnContext: CallReturnContext[]) => {
        for (const ret of callsReturnContext) {
          const [
            config, state, sA, sB, sC, rA, rB, rC, twap, spot
          ] = ret.returnValues.map(v => v.type == 'BigNumber' ? BigNumber.from(v.hex) : v)
          const [ R, a, b ] = state
          console.log(pool.address, {
            config, state, sA, sB, sC, rA, rB, rC, twap, spot
          })
          pool.state = { R, a, b }
          pool.view = { sA, sB, sC, rA, rB, rC, twap, spot }
        }
      },
    })))
  }

  async _multicall(
    contexts: ContractCallContext[],
  ): Promise<any[]> {
    const callbacks: { [reference: string]: any } = {}
    for (const context of contexts) {
      if (callbacks[context.reference]) {
        throw new Error(`dupplicated reference: ${context.reference}`)
      }
      callbacks[context.reference] = context.context
      delete context.context
    }
    const { results } = await this.mc.call(contexts);
    return Object.values(results).map(result => {
      const callback = callbacks[result.originalContractCallContext.reference]
      if (callback != null && typeof callback === 'function') {
        return callback(result.callsReturnContext)
      }
    })
  }
}
