import {BigNumber,Signer} from 'ethers'
import {Profile} from '../profile'
import {Aggregator} from '../services/aggregator'
import {History,HistoryEntry} from '../services/history'
import {Resource} from '../services/resource'
import {Swap} from '../services/swap'
import {PoolsType} from '../types'
import {ProfileConfigs} from '../utils/configs'
import {Position} from './position'

export class StateLoader {
  configs: ProfileConfigs
  profile: Profile
  SWAP: Swap
  AGGREGATOR: Aggregator
  RESOURCE: Resource
  HISTORY: History

  constructor(configs: ProfileConfigs) {
    this.profile = new Profile(configs)
    this.configs = configs
    const _configs = {
      ...configs,
      RESOURCE: this.RESOURCE,
    }
    this.AGGREGATOR = new Aggregator(_configs, this.profile)
    this.RESOURCE = new Resource(this.configs, this.profile)
    this.HISTORY = new History(_configs, this.profile)

    this.SWAP = new Swap({ ...this.configs, RESOURCE: this.RESOURCE, AGGREGATOR: this.AGGREGATOR }, this.profile)
  }
  loadPools = async () => {}
  loadPositions = async () => {}
}
