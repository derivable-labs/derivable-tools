import { LogType, SdkPools } from '../types'
import { BigNumber, Signer } from 'ethers'
import { ProfileConfigs } from '../utils/configs'
import { Profile } from '../profile'
import { Account } from './account'
import { StateLoader } from './stateLoader'
import { Networkish } from '@ethersproject/providers'
import { ConnectionInfo } from 'ethers/lib/utils'
import { extractPoolAddresses } from './utils/logs'
import {Swapper} from './swapper'
import { FungiblePosition } from '../services/history'
import { calcPositionState, PositionView } from './utils/positions'

export class DerionSDK {
  configs: ProfileConfigs

  constructor(configs: ProfileConfigs) {
    this.configs = configs
    this.profile = new Profile(configs)
  }

  profile: Profile
  stateLoader: StateLoader

  async init() {
    await this.profile.loadConfig()
  }

  getStateLoader(url?: ConnectionInfo | string, network?: Networkish) {
    return this.stateLoader = this.stateLoader ?? new StateLoader(this.profile, url, network)
  }

  extractLogs = (txLogs: LogType[][]): { poolAddresses: string[] } => {
    return {
      poolAddresses: extractPoolAddresses(txLogs, this.profile.configs.derivable.token),
    }
  }

  createAccount(address: string, signer?: Signer): Account {
    return new Account(this.profile, address, signer)
  }

  createSwapper = (url?: ConnectionInfo | string, network?: Networkish) => {
    return new Swapper(this.configs, this.profile, url, network)
  }

  calcPositionState = (
    position: FungiblePosition,
    pools: SdkPools,
    currentPriceR = position.priceR,
    balance = position.balance,
  ): PositionView => {
    return calcPositionState(position, pools, currentPriceR, balance)
  }
}
