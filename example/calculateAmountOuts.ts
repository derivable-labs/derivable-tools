import {Engine} from '../src/engine'
import {bn, numberToWei, packId} from '../src/utils/helper'
import {getTestConfigs} from './shared/testConfigs'
import {NATIVE_ADDRESS, POOL_IDS} from '../src/utils/constant'
import TokenAbi from '../src/abi/Token.json'
import {ethers} from "ethers";

const testLocal = async () => {
  const configs = getTestConfigs(56)
  const engine = new Engine(configs)
  await engine.initServices()
  await engine.RESOURCE.fetchResourceData(configs.account)

  const currentPool = engine.RESOURCE.poolGroups['0x49B355Bb422dC456314D160C353416afBcAF2996']
  engine.setCurrentPool({
    ...currentPool,
  })

  const poolOut = '0x40e0bE42699aDe6e6d5f1005F219152A941d16CA'
  const provider = new ethers.providers.JsonRpcProvider(engine.profile.configs.rpc)
  // @ts-ignore
  const tokenContract = new ethers.Contract( engine.profile.configs.derivable.token, TokenAbi, provider)
  const currentBalanceOut = await tokenContract.balanceOf(configs.account, packId(POOL_IDS.A.toString(), poolOut))
  const steps = [
    {
      amountIn: bn(numberToWei(0.01, 6)),
      tokenIn: "0xa70926b457618DD7F7a181a5B1b964208159fdD6",
      tokenOut: poolOut + '-' + POOL_IDS.C,
      amountOutMin: 0,
      currentBalanceOut,
      useSweep: true
    },
  ]

  try {
    const res = await engine.SWAP.calculateAmountOuts(steps)
    console.log(res[0][0].amountOut.toString())
    console.log(res)
  } catch (e) {
    console.log(e)
  }
}

testLocal()
