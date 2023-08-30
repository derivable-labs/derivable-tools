import { BigNumber, Contract, ethers } from 'ethers';
import { UniV2Pair } from './uniV2Pair';
import { SwapStepType } from '../types';
import { CurrentPool } from './currentPool';
import { JsonRpcProvider } from '@ethersproject/providers';
import { ConfigType } from './setConfig';
import { Profile } from "../profile";
export declare class Swap {
    account?: string;
    chainId: number;
    scanApi?: string;
    provider: ethers.providers.Provider;
    overrideProvider: JsonRpcProvider;
    signer?: ethers.providers.JsonRpcSigner;
    UNIV2PAIR: UniV2Pair;
    CURRENT_POOL: CurrentPool;
    config: ConfigType;
    profile: Profile;
    constructor(config: ConfigType & {
        CURRENT_POOL: CurrentPool;
    }, profile: Profile);
    calculateAmountOuts(steps: SwapStepType[]): Promise<(BigNumber | BigNumber[])[] | (BigNumber | {
        amountOut: any;
        tokenIn: string;
        tokenOut: string;
        amountIn: BigNumber;
        payloadAmountIn?: BigNumber | undefined;
        amountOutMin: string | number | BigNumber;
        useSweep?: boolean | undefined;
        currentBalanceOut?: BigNumber | undefined;
        index_R?: BigNumber | undefined;
    }[])[]>;
    callStaticMultiSwap({ params, value, gasLimit }: any): Promise<any>;
    convertStepToActions(steps: SwapStepType[]): Promise<{
        params: any;
        value: BigNumber;
    }>;
    getSweepCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }: {
        step: any;
        poolGroup: any;
        poolIn: string;
        poolOut: string;
        idIn: BigNumber;
        idOut: BigNumber;
    }): {
        inputs: {
            mode: number;
            eip: number;
            token: any;
            id: number | BigNumber;
            amountIn: any;
            recipient: string;
        }[];
        populateTxData: Promise<ethers.PopulatedTransaction>[];
    };
    getSwapCallData({ step, poolGroup, poolIn, poolOut, idIn, idOut }: {
        step: any;
        poolGroup: any;
        poolIn: string;
        poolOut: string;
        idIn: BigNumber;
        idOut: BigNumber;
    }): {
        inputs: {
            mode: number;
            eip: number;
            token: any;
            id: number | BigNumber;
            amountIn: any;
            recipient: string;
        }[];
        populateTxData: Promise<ethers.PopulatedTransaction>[];
    };
    generateSwapParams(method: string, params: any): Promise<ethers.PopulatedTransaction>;
    getIdByAddress(address: string, TOKEN_R: string): BigNumber;
    getPoolPoolGroup(addressIn: string, addressOut: string): {
        pools: {};
        TOKEN_R: string;
    };
    multiSwap(steps: SwapStepType[], gasLimit?: BigNumber): Promise<any>;
    getAddressByErc1155Address(address: string, TOKEN_R: string): string;
    getRouterContract(provider: any): Contract;
    getStateCalHelperContract(provider?: any): Contract;
}
