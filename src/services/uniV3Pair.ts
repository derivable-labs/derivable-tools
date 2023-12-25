import { BigNumber, ethers } from 'ethers'
import PairV3DetailAbi from '../abi/PairV3Detail.json'
import UniswapV3FactoryAbi from '../abi/UniswapV3Factory.json'
import ERC20Abi from '../abi/ERC20.json'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ContractCallContext, Multicall } from 'ethereum-multicall'
import { IDerivableContractAddress, IEngineConfig } from '../utils/configs'
import { CallReturnContext } from 'ethereum-multicall/dist/esm/models/call-return-context'
import { ZERO_ADDRESS } from '../utils/constant'
import { bn } from '../utils/helper'
import { Profile } from '../profile'
import { TokenType } from '../types'

const POOL_FEES = [100, 300, 500]
const FLAG = '0x0000110000000000000000000000000000000000000000000000000000000111'
// type ConfigType = {
//   chainId: number
//   scanApi: string
//   provider: ethers.providers.Provider
//   rpcUrl: string
// }

export type IPairInfo = {
  token0: TokenType & { reserve: BigNumber }
  token1: TokenType & { reserve: BigNumber }
}

export type IPairsInfo = {
  [pair: string]: IPairInfo
}

export class UniV3Pair {
  chainId: number
  scanApi?: string
  provider: ethers.providers.Provider
  rpcUrl: string
  pairsV3Info: string
  addresses: Partial<IDerivableContractAddress>
  profile: Profile

  constructor(config: IEngineConfig, profile: Profile) {
    const pairsV3Info = '0x' + PairV3DetailAbi.deployedBytecode.slice(-40)
    this.chainId = config.chainId
    this.scanApi = profile.configs.scanApi
    this.provider = new JsonRpcProvider(profile.configs.rpc)
    this.rpcUrl = profile.configs.rpc
    this.pairsV3Info = pairsV3Info
    this.profile = profile
  }

  async getLargestPoolAddress({ baseToken, quoteTokens }: { baseToken: string; quoteTokens: string[] }): Promise<string> {
    const pools = await this.getPairAddress({ baseToken, quoteTokens })
    return await this._getLargestPoolByPools(baseToken, pools)
  }

  /**
   *
   * @param baseToken
   * @param pools
   * poolsType: {
   *   [`${baseAddress-quoteAddress-fee}`]: poolAddress
   * }
   */
  async _getLargestPoolByPools(baseToken: string, pools: { [key: string]: string }): Promise<string> {
    const multicall = this._getMulticall()
    const res = await multicall.call(this._generatePoolBalanceContext(baseToken, pools))
    return this._parsePoolBalanceReturnContext(res.results.poolBalances.callsReturnContext)
  }

  _parsePoolBalanceReturnContext(returnContexts: CallReturnContext[]) {
    let poolResults = ZERO_ADDRESS
    let max = bn(0)
    returnContexts.forEach((returnContext) => {
      if (bn(returnContext.returnValues[0].hex).gt(max)) {
        poolResults = returnContext.reference
        max = bn(returnContext.returnValues[0].hex)
      }
    })
    return poolResults
  }

  _generatePoolBalanceContext(baseToken: string, pools: { [key: string]: string }) {
    const calls: any = []
    for (let i in pools) {
      calls.push({
        reference: pools[i],
        methodName: 'balanceOf',
        methodParameters: [pools[i]],
      })
    }
    return [
      {
        reference: 'poolBalances',
        contractAddress: baseToken,
        abi: ERC20Abi,
        calls,
      },
    ]
  }

  async getPairAddress({ baseToken, quoteTokens }: { baseToken: string; quoteTokens: string[] }): Promise<{ [key: string]: string }> {
    const multicall = this._getMulticall()

    //@ts-ignore
    const context: ContractCallContext[] = this._generatePoolAddressContext(baseToken, quoteTokens)
    const res = await multicall.call(context)
    return this._parsePoolAddressReturnContext(res.results.poolAddresses['callsReturnContext'])
  }

  _parsePoolAddressReturnContext(returnContexts: CallReturnContext[]) {
    const results = {}
    returnContexts.forEach((returnContext) => {
      if (returnContext.returnValues[0] !== ZERO_ADDRESS) {
        results[returnContext.reference] = returnContext.returnValues[0]
      }
    })
    return results
  }

  _generatePoolAddressContext(baseToken: string, quoteTokens: string[]) {
    const calls: any = []
    POOL_FEES.forEach((fee) => {
      quoteTokens.forEach((quoteToken) => {
        calls.push({
          reference: `${baseToken}-${quoteToken}-${fee}`,
          methodName: 'getPool',
          methodParameters: [baseToken, quoteToken, fee],
        })
      })
    })
    return [
      {
        reference: 'poolAddresses',
        contractAddress: this.profile.configs.uniswap.v3Factory,
        abi: UniswapV3FactoryAbi,
        calls,
      },
    ]
  }

  async getPairInfo({ pairAddress, flag = FLAG }: { pairAddress: string; flag?: string }) {
    try {
      const provider = new JsonRpcProvider(this.rpcUrl)
      // @ts-ignore
      provider.setStateOverride({
        [this.pairsV3Info]: {
          code: PairV3DetailAbi.deployedBytecode,
        },
      })

      const pairDetailContract = new ethers.Contract(this.pairsV3Info, PairV3DetailAbi.abi, provider)

      const res = await pairDetailContract.functions.query([pairAddress], flag)
      return res.details[0]
    } catch (e) {
      throw e
    }
  }

  async getPairsInfo({ pairAddresses, flag = FLAG }: { flag?: string; pairAddresses: string[] }): Promise<IPairsInfo> {
    try {
      const provider = new JsonRpcProvider(this.rpcUrl)
      // @ts-ignore
      provider.setStateOverride({
        [this.pairsV3Info]: {
          code: PairV3DetailAbi.deployedBytecode,
        },
      })

      const pairDetailContract = new ethers.Contract(this.pairsV3Info, PairV3DetailAbi.abi, provider)

      const { details } = await pairDetailContract.functions.query(pairAddresses, flag)
      const result = {}
      for (let i = 0; i < pairAddresses.length; i++) {
        result[pairAddresses[i]] = {
          token0: {
            address: details[i].token0.adr,
            name: details[i].token0.name,
            symbol: details[i].token0.symbol,
            decimals: details[i].token0.decimals.toNumber(),
            reserve: details[i].token0.reserve,
          },
          token1: {
            address: details[i].token1.adr,
            name: details[i].token1.name,
            symbol: details[i].token1.symbol,
            decimals: details[i].token1.decimals.toNumber(),
            reserve: details[i].token1.reserve,
          },
        }
      }
      return result
    } catch (e) {
      throw e
    }
  }

  _getMulticall() {
    return new Multicall({
      multicallCustomContractAddress: this.profile.configs.helperContract.multiCall,
      ethersProvider: this.provider,
      tryAggregate: true,
    })
  }
}
