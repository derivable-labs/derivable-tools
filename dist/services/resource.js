"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resource = exports.M256 = exports.Q128 = void 0;
const ethers_1 = require("ethers");
const constant_1 = require("../utils/constant");
const ethereum_multicall_1 = require("ethereum-multicall");
const helper_1 = require("../utils/helper");
const providers_1 = require("@ethersproject/providers");
const lodash_1 = __importDefault(require("lodash"));
const uniV3Pair_1 = require("./uniV3Pair");
const utils_1 = require("ethers/lib/utils");
const OracleSdk = __importStar(require("../utils/OracleSdk"));
const OracleSdkAdapter = __importStar(require("../utils/OracleSdkAdapter"));
const { AssistedJsonRpcProvider } = require('assisted-json-rpc-provider');
const MAX_BLOCK = 4294967295;
exports.Q128 = (0, helper_1.bn)(1).shl(128);
exports.M256 = (0, helper_1.bn)(1).shl(256).sub(1);
const { A, B, C } = constant_1.POOL_IDS;
function numDiv(b, unit = 1) {
    try {
        return b.toNumber() / unit;
    }
    catch (err) {
        if (err.reason == 'overflow') {
            return Infinity;
        }
        throw err;
    }
}
class Resource {
    constructor(engineConfigs, profile) {
        this.poolGroups = {};
        this.pools = {};
        this.tokens = [];
        this.swapLogs = [];
        this.transferLogs = [];
        this.unit = 1000000;
        this.chainId = engineConfigs.chainId;
        this.scanApi = profile.configs.scanApi;
        this.scanApiKey = engineConfigs.scanApiKey;
        this.account = engineConfigs.account;
        this.storage = engineConfigs.storage;
        this.account = engineConfigs.account;
        this.providerToGetLog = new ethers_1.ethers.providers.JsonRpcProvider(profile.configs.rpcGetLog || profile.configs.rpc);
        this.provider = new ethers_1.ethers.providers.JsonRpcProvider(profile.configs.rpc);
        this.UNIV3PAIR = new uniV3Pair_1.UniV3Pair(engineConfigs, profile);
        this.overrideProvider = new providers_1.JsonRpcProvider(profile.configs.rpc);
        this.derivableAddress = profile.configs.derivable;
        this.profile = profile;
        this.stableCoins = profile.configs.stablecoins;
    }
    async fetchResourceData(account, playMode) {
        let result = {};
        if (!this.chainId)
            return result;
        const [resultCached, newResource] = await Promise.all([
            this.getResourceCached(account, playMode),
            this.getNewResource(account, playMode),
        ]);
        this.poolGroups = { ...resultCached.poolGroups, ...newResource.poolGroups };
        this.pools = { ...resultCached.pools, ...newResource.pools };
        this.tokens = [...resultCached.tokens, ...newResource.tokens];
        this.swapLogs = [...resultCached.swapLogs, ...newResource.swapLogs];
        this.transferLogs = [...resultCached.transferLogs, ...newResource.transferLogs];
    }
    getLastBlockCached(account) {
        if (!this.storage || !this.storage.getItem)
            return this.profile.configs.derivable.startBlock;
        const lastDDlBlock = Number(this.storage.getItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.LAST_BLOCK_DDL_LOGS)) ||
            this.profile.configs.derivable.startBlock - 1;
        let lastWalletBlock = this.profile.configs.derivable.startBlock - 1;
        const walletBlockCached = this.storage.getItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.SWAP_BLOCK_LOGS + '-' + account);
        if (account && walletBlockCached) {
            lastWalletBlock = Number(walletBlockCached);
        }
        return Math.min(lastDDlBlock + 1, lastWalletBlock + 1);
    }
    cacheDdlLog({ swapLogs, ddlLogs, 
    //@ts-ignore
    transferLogs, headBlock, account, }) {
        if (!this.storage || !this.storage.getItem || !this.storage.setItem)
            return;
        const cachedDdlLogs = JSON.parse(this.storage.getItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.DDL_LOGS) || '[]');
        const newCachedDdlLogs = [...ddlLogs, ...cachedDdlLogs].filter((log, index, self) => {
            return index === self.findIndex((t) => t.logIndex === log.logIndex && t.transactionHash === log.transactionHash);
        });
        this.storage.setItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.LAST_BLOCK_DDL_LOGS, headBlock.toString());
        this.storage.setItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.DDL_LOGS, JSON.stringify(newCachedDdlLogs));
        if (account) {
            this.cacheNewAccountLogs(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.SWAP_LOGS + '-' + account, this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.SWAP_BLOCK_LOGS + '-' + account, swapLogs, headBlock);
            this.cacheNewAccountLogs(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.TRANSFER_LOGS + '-' + account, this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.TRANSFER_BLOCK_LOGS + '-' + account, transferLogs, headBlock);
        }
    }
    cacheNewAccountLogs(key, blockKey, newLogs, headBlock) {
        if (!this.storage || !this.storage.getItem || !this.storage.setItem)
            return;
        const cachedogs = JSON.parse(this.storage.getItem(key) || '[]');
        const newCacheSwapLogs = [...newLogs, ...cachedogs].filter((log, index, self) => {
            return index === self.findIndex((t) => t.logIndex === log.logIndex && t.transactionHash === log.transactionHash);
        });
        this.storage.setItem(blockKey, headBlock.toString());
        this.storage.setItem(key, JSON.stringify(newCacheSwapLogs));
    }
    async getResourceCached(account, playMode) {
        const results = {
            pools: {},
            tokens: this._whitelistTokens(),
            swapLogs: [],
            transferLogs: [],
            poolGroups: {},
        };
        if (!this.storage || !this.storage.getItem)
            return results;
        const ddlLogs = JSON.parse(this.storage.getItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.DDL_LOGS) || '[]');
        const swapLogs = JSON.parse(this.storage.getItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.SWAP_LOGS + '-' + account) || '[]');
        const transferLogs = JSON.parse(this.storage.getItem(this.chainId + '-' + constant_1.LOCALSTORAGE_KEY.TRANSFER_LOGS + '-' + account) || '[]');
        const [ddlLogsParsed, swapLogsParsed, transferLogsParsed] = [
            this.parseDdlLogs(ddlLogs),
            this.parseDdlLogs(swapLogs),
            this.parseDdlLogs(transferLogs),
        ];
        if (ddlLogsParsed && ddlLogsParsed.length > 0) {
            const { tokens, pools, poolGroups } = await this.generatePoolData(ddlLogsParsed, transferLogsParsed, playMode);
            results.tokens = [...tokens, ...results.tokens];
            results.pools = pools;
            results.poolGroups = poolGroups;
        }
        if (swapLogsParsed && swapLogsParsed.length > 0) {
            results.swapLogs = swapLogsParsed;
        }
        if (transferLogsParsed && transferLogsParsed.length > 0) {
            results.transferLogs = transferLogsParsed;
        }
        this.pools = { ...results.pools, ...this.pools };
        return results;
    }
    async getNewResource(account, playMode) {
        // TODO: move this part to constructor
        const etherscanConfig = typeof this.scanApi === 'string'
            ? {
                url: this.scanApi,
                maxResults: 1000,
                rangeThreshold: 0,
                rateLimitCount: 1,
                rateLimitDuration: 5000,
                apiKeys: this.scanApiKey ? [this.scanApiKey] : [],
            }
            : this.scanApi;
        const provider = new AssistedJsonRpcProvider(this.providerToGetLog, etherscanConfig);
        const lastHeadBlockCached = this.getLastBlockCached(account);
        const accTopic = account ? '0x' + '0'.repeat(24) + account.slice(2) : null;
        const topics = (0, helper_1.getTopics)();
        let filterTopics = [topics.Derivable[0], null, null, null];
        if (accTopic) {
            filterTopics = [
                [topics.Derivable[0], null, null, null],
                [null, accTopic, null, null],
                [null, null, accTopic, null],
                [null, null, null, accTopic],
            ];
        }
        return await provider
            .getLogs({
            fromBlock: lastHeadBlockCached,
            toBlock: MAX_BLOCK,
            topics: filterTopics,
        })
            .then((logs) => {
            if (!logs?.length) {
                return [[], [], []];
            }
            const headBlock = logs[logs.length - 1]?.blockNumber;
            const ddlLogs = logs.filter((log) => {
                return log.address && topics.Derivable.includes(log.topics[0]) && log.address === this.derivableAddress.poolFactory;
            });
            const swapLogs = logs.filter((log) => {
                return log.address && topics.Swap.includes(log.topics[0]);
            });
            const transferLogs = logs.filter((log) => {
                return log.address && topics.Transfer.includes(log.topics[0]);
            });
            this.cacheDdlLog({
                ddlLogs,
                swapLogs,
                transferLogs,
                headBlock,
                account,
            });
            return [this.parseDdlLogs(ddlLogs), this.parseDdlLogs(swapLogs), this.parseDdlLogs(transferLogs)];
        })
            .then(async ([ddlLogs, swapLogs, transferLogs]) => {
            const result = {
                pools: {},
                tokens: [],
                swapLogs: [],
                transferLogs: [],
                poolGroups: {},
            };
            if (swapLogs && swapLogs.length > 0) {
                result.swapLogs = swapLogs;
            }
            if (transferLogs && transferLogs.length > 0) {
                result.transferLogs = transferLogs;
            }
            if (ddlLogs && ddlLogs.length > 0) {
                const { tokens, pools, poolGroups } = await this.generatePoolData(ddlLogs, transferLogs, playMode);
                result.tokens = tokens;
                result.pools = pools;
                result.poolGroups = poolGroups;
            }
            this.pools = { ...result.pools, ...this.pools };
            return result;
        })
            .catch((e) => {
            console.error(e);
            return { pools: {}, tokens: [], swapLogs: [], transferLogs: [] };
        });
    }
    /**
     * parse DDL logs
     * @param logs
     * @param transferLogs
     * @param tokenAddresses
     */
    generatePoolData(logs, transferLogs, playMode) {
        const allTokens = [...this._tokenInRoutes()];
        const allUniPools = [];
        const poolData = {};
        logs.forEach((log) => {
            if (log.name === 'PoolCreated') {
                const data = log.args;
                if (!!playMode != (data.TOKEN_R == this.profile.configs.derivable.playToken)) {
                    return;
                }
                const powers = [log.args.k.toNumber(), -log.args.k.toNumber()];
                const pair = ethers_1.ethers.utils.getAddress('0x' + data.ORACLE.slice(-40));
                const quoteTokenIndex = (0, helper_1.bn)(data.ORACLE.slice(0, 3)).gt(0) ? 1 : 0;
                const window = (0, helper_1.bn)('0x' + data.ORACLE.substring(2 + 8, 2 + 8 + 8));
                if (data.FETCHER !== constant_1.ZERO_ADDRESS && data.FETCHER !== this.profile.configs.derivable.uniswapV2Fetcher) {
                    return;
                }
                data.dTokens = powers.map((value, key) => {
                    return { power: value, index: key };
                });
                data.dTokens = data.dTokens.map((data) => `${log.address}-${data.index}`);
                poolData[log.address] = {
                    ...data,
                    poolAddress: log.address,
                    powers,
                    cToken: data.TOKEN_R,
                    pair,
                    window,
                    quoteTokenIndex
                };
                allUniPools.push(pair);
                allTokens.push(data.TOKEN_R);
            }
        });
        transferLogs.forEach((log) => {
            allTokens.push(log.contractAddress);
        });
        allTokens.push(...this.stableCoins);
        return this.loadStatesData(allTokens, poolData, allUniPools);
    }
    /**
     * load Token detail, poolstate data and then dispatch to Store
     * @param listTokens
     * @param listPools
     * @param uniPools
     */
    async loadStatesData(listTokens, listPools, uniPools) {
        const multicall = new ethereum_multicall_1.Multicall({
            multicallCustomContractAddress: this.profile.configs.helperContract.multiCall,
            ethersProvider: this.getPoolOverridedProvider(),
            tryAggregate: true,
        });
        const normalTokens = lodash_1.default.uniq((0, helper_1.getNormalAddress)(listTokens));
        const pairsInfo = await this.UNIV3PAIR.getPairsInfo({
            pairAddresses: lodash_1.default.uniq(uniPools),
        });
        const pricesInfo = await this.getPrices(listPools, pairsInfo);
        // @ts-ignore
        const context = this.getMultiCallRequest(normalTokens, listPools, pricesInfo);
        const [{ results }] = await Promise.all([
            multicall.call(context),
        ]);
        const { tokens: tokensArr, poolsState } = this.parseMultiCallResponse(results, Object.keys(listPools));
        const tokens = [];
        for (let i = 0; i < tokensArr.length; i++) {
            tokens.push({
                symbol: tokensArr[i][0],
                name: tokensArr[i][1],
                decimal: tokensArr[i][2],
                totalSupply: tokensArr[i][3],
                address: normalTokens[i],
            });
        }
        const pools = { ...listPools };
        const poolGroups = {};
        for (const i in pools) {
            if (!poolsState[i]) {
                delete pools[i];
                continue;
            }
            pools[i].states = poolsState[i];
            pools[i] = {
                ...pools[i],
                ...this.calcPoolInfo(pools[i]),
            };
            const { MARK: _MARK, ORACLE, k: _k } = pools[i];
            const quoteTokenIndex = (0, helper_1.bn)(ORACLE.slice(0, 3)).gt(0) ? 1 : 0;
            const pair = ethers_1.ethers.utils.getAddress('0x' + ORACLE.slice(-40));
            const baseToken = quoteTokenIndex === 0 ? pairsInfo[pair].token1 : pairsInfo[pair].token0;
            const quoteToken = quoteTokenIndex === 0 ? pairsInfo[pair].token0 : pairsInfo[pair].token1;
            const tokenR = tokens.find((t) => t.address === pools[i].TOKEN_R);
            pools[i].baseToken = baseToken.address;
            pools[i].quoteToken = quoteToken.address;
            const k = _k.toNumber();
            const id = [pair].join('-');
            if (poolGroups[id]) {
                poolGroups[id].pools[i] = pools[i];
            }
            else {
                poolGroups[id] = { pools: { [i]: pools[i] } };
                poolGroups[id].UTR = pools[i].UTR;
                poolGroups[id].pair = pairsInfo[pair];
                poolGroups[id].quoteTokenIndex = quoteTokenIndex;
                poolGroups[id].baseToken = pools[i].baseToken;
                poolGroups[id].quoteToken = pools[i].quoteToken;
                poolGroups[id].TOKEN = pools[i].TOKEN;
                poolGroups[id].MARK = pools[i].MARK;
                poolGroups[id].INIT_TIME = pools[i].INIT_TIME;
                poolGroups[id].HALF_LIFE = pools[i].HALF_LIFE;
                poolGroups[id].ORACLE = pools[i].ORACLE;
                poolGroups[id].TOKEN_R = pools[i].TOKEN_R;
                poolGroups[id].states = {
                    twapBase: poolsState[i].twap,
                    spotBase: poolsState[i].spot,
                    ...poolsState[i],
                };
                poolGroups[id].basePrice = (0, helper_1.parsePrice)(poolsState[i].spot, baseToken, quoteToken, pools[i]);
            }
            const rdc = this.getRdc(Object.values(poolGroups[id].pools));
            poolGroups[id].states = {
                ...poolGroups[id].states,
                ...rdc,
            };
            if (poolGroups[id].powers) {
                poolGroups[id].k.push(pools[i].k.toNumber());
                poolGroups[id].powers.push(pools[i].powers[0], pools[i].powers[1]);
            }
            else {
                poolGroups[id].k = [pools[i].k.toNumber()];
                poolGroups[id].powers = [...pools[i].powers];
            }
            if (poolGroups[id].dTokens) {
                poolGroups[id].dTokens.push(pools[i].poolAddress + '-' + constant_1.POOL_IDS.A, pools[i].poolAddress + '-' + constant_1.POOL_IDS.B);
            }
            else {
                poolGroups[id].dTokens = [pools[i].poolAddress + '-' + constant_1.POOL_IDS.A, pools[i].poolAddress + '-' + constant_1.POOL_IDS.B];
            }
            if (poolGroups[id].allTokens) {
                poolGroups[id].allTokens.push(pools[i].poolAddress + '-' + constant_1.POOL_IDS.A, pools[i].poolAddress + '-' + constant_1.POOL_IDS.B, pools[i].poolAddress + '-' + constant_1.POOL_IDS.C);
            }
            else {
                poolGroups[id].allTokens = [
                    pools[i].poolAddress + '-' + constant_1.POOL_IDS.A,
                    pools[i].poolAddress + '-' + constant_1.POOL_IDS.B,
                    pools[i].poolAddress + '-' + constant_1.POOL_IDS.C,
                ];
            }
            tokens.push({
                symbol: baseToken.symbol + '^' + (1 + k / 2),
                name: baseToken.symbol + '^' + (1 + k / 2),
                decimal: tokenR.decimal,
                totalSupply: 0,
                address: pools[i].poolAddress + '-' + constant_1.POOL_IDS.A,
            }, {
                symbol: baseToken.symbol + '^' + (1 - k / 2),
                name: baseToken.symbol + '^' + (1 - k / 2),
                decimal: tokenR.decimal,
                totalSupply: 0,
                address: pools[i].poolAddress + '-' + constant_1.POOL_IDS.B,
            }, {
                symbol: `DLP-${baseToken.symbol}-${k / 2}`,
                name: `DLP-${baseToken.symbol}-${k / 2}`,
                decimal: tokenR.decimal,
                totalSupply: 0,
                address: pools[i].poolAddress + '-' + constant_1.POOL_IDS.C,
            }, baseToken, quoteToken);
        }
        return {
            // @ts-ignore
            tokens: lodash_1.default.uniqBy(tokens, 'address'),
            pools,
            poolGroups,
        };
    }
    getRentRate({ rDcLong, rDcShort, R }, rentRate) {
        const diff = (0, helper_1.bn)(rDcLong).sub(rDcShort).abs();
        const rate = R.isZero() ? (0, helper_1.bn)(0) : diff.mul(rentRate).div(R);
        return {
            rentRateLong: rDcLong.add(rDcShort).isZero() ? (0, helper_1.bn)(0) : rate.mul(rDcLong).div(rDcLong.add(rDcShort)),
            rentRateShort: rDcLong.add(rDcShort).isZero() ? (0, helper_1.bn)(0) : rate.mul(rDcShort).div(rDcLong.add(rDcShort)),
        };
    }
    getPoolOverridedProvider() {
        const stateOverride = {};
        // poolAddresses.forEach((address: string) => {
        stateOverride[this.derivableAddress.logic] = {
            code: this.profile.getAbi('PoolOverride').deployedBytecode,
        };
        // })
        //@ts-ignore
        this.overrideProvider.setStateOverride({
            ...stateOverride,
            [('0x' + this.profile.getAbi('TokensInfo').deployedBytecode.slice(-40))]: {
                code: this.profile.getAbi('TokensInfo').deployedBytecode,
            },
        });
        return this.overrideProvider;
    }
    /**
     * get Multicall Request to get List token and poolState data in 1 request to RPC
     * @param normalTokens
     * @param listPools
     */
    getMultiCallRequest(normalTokens, listPools, 
    //@ts-ignore
    pricesInfo) {
        const request = [
            {
                reference: 'tokens',
                contractAddress: '0x' + this.profile.getAbi('TokensInfo').deployedBytecode.slice(-40),
                abi: this.profile.getAbi('TokensInfo').abi,
                calls: [
                    {
                        reference: 'tokenInfos',
                        methodName: 'getTokenInfo',
                        methodParameters: [normalTokens],
                    },
                ],
            },
        ];
        const poolOverrideAbi = this.profile.getAbi('PoolOverride').abi;
        for (const i in listPools) {
            request.push({
                // @ts-ignore
                decoded: true,
                reference: 'pools-' + listPools[i].poolAddress,
                contractAddress: listPools[i].poolAddress,
                // @ts-ignore
                abi: poolOverrideAbi,
                calls: [
                    {
                        reference: i,
                        methodName: 'compute',
                        methodParameters: [
                            this.derivableAddress.token,
                            5,
                            pricesInfo[listPools[i].poolAddress]?.twap || (0, helper_1.bn)(0),
                            pricesInfo[listPools[i].poolAddress]?.spot || (0, helper_1.bn)(0),
                        ],
                    },
                ],
            });
        }
        return request;
    }
    parseMultiCallResponse(multiCallData, poolAddresses) {
        const pools = {};
        const tokens = multiCallData.tokens.callsReturnContext[0].returnValues;
        const poolOverrideAbi = this.profile.getAbi('PoolOverride').abi;
        poolAddresses.forEach((poolAddress) => {
            try {
                const abiInterface = new ethers_1.ethers.utils.Interface(poolOverrideAbi);
                const poolStateData = multiCallData['pools-' + poolAddress].callsReturnContext;
                const data = (0, helper_1.formatMultiCallBignumber)(poolStateData[0].returnValues);
                const encodeData = abiInterface.encodeFunctionResult('compute', [data]);
                const formatedData = abiInterface.decodeFunctionResult('compute', encodeData);
                pools[poolStateData[0].reference] = {
                    // twapBase: formatedData.states.twap.base._x,
                    // twapLP: formatedData.states.twap.LP._x,
                    // spotBase: formatedData.states.spot.base._x,
                    // spotLP: formatedData.states.spot.LP._x,
                    ...formatedData.stateView,
                    ...formatedData.stateView.state,
                };
            }
            catch (e) {
                console.error('Cannot get states of: ', poolAddress);
                console.error(e);
            }
        });
        return { tokens, poolsState: pools };
    }
    calcPoolInfo(pool) {
        const { FETCHER, MARK, states } = pool;
        const version = (!FETCHER || FETCHER == constant_1.ZERO_ADDRESS) ? 3 : 2;
        const { R, rA, rB, rC, a, b, spot } = states;
        const riskFactor = rC.gt(0) ? (0, helper_1.div)(rA.sub(rB), rC) : '0';
        const deleverageRiskA = R.isZero()
            ? 0
            : rA
                .mul(2 * this.unit)
                .div(R)
                .toNumber() / this.unit;
        const deleverageRiskB = R.isZero()
            ? 0
            : rB
                .mul(2 * this.unit)
                .div(R)
                .toNumber() / this.unit;
        const k = pool.k.toNumber();
        const power = version == 3 ? k / 2 : k;
        const sides = {
            [A]: {},
            [B]: {},
            [C]: {},
        };
        sides[A].k = Math.min(k, (0, helper_1.kx)(k, R, a, spot, MARK));
        sides[B].k = Math.min(k, -(0, helper_1.kx)(-k, R, b, spot, MARK));
        sides[C].k = numDiv(rA.mul(Math.round(sides[A].k * this.unit))
            .add(rB.mul(Math.round(sides[B].k * this.unit)))
            .div(rA.add(rB)), this.unit);
        const interestRate = (0, helper_1.rateFromHL)(pool.INTEREST_HL.toNumber(), power);
        const maxPremiumRate = (0, helper_1.rateFromHL)(pool.PREMIUM_HL.toNumber(), power);
        if (maxPremiumRate > 0) {
            if (rA.gt(rB)) {
                const rDiff = rA.sub(rB);
                const givingRate = rDiff.mul(Math.round(this.unit * maxPremiumRate));
                const receivingRate = numDiv(givingRate.div(rB.add(rC)), this.unit);
                sides[A].premium = numDiv(givingRate.div(rA), this.unit);
                sides[B].premium = -receivingRate;
                sides[C].premium = receivingRate;
            }
            else if (rB.gt(rA)) {
                const rDiff = rB.sub(rA);
                const givingRate = rDiff.mul(Math.round(this.unit * maxPremiumRate));
                const receivingRate = numDiv(givingRate.div(rA.add(rC)), this.unit);
                sides[B].premium = numDiv(givingRate.div(rB), this.unit);
                sides[A].premium = -receivingRate;
                sides[C].premium = receivingRate;
            }
            else {
                sides[A].premium = 0;
                sides[B].premium = 0;
                sides[C].premium = 0;
            }
        }
        // decompound the interest
        for (const side of [A, B]) {
            sides[side].interest = (interestRate * k) / sides[side].k;
        }
        sides[C].interest = numDiv(rA.add(rB).mul(Math.round(this.unit * interestRate)).div(rC), this.unit);
        return {
            sides,
            riskFactor,
            deleverageRiskA,
            deleverageRiskB,
            interestRate,
            maxPremiumRate,
        };
    }
    getRdc(pools) {
        let rC = (0, helper_1.bn)(0);
        let rDcLong = (0, helper_1.bn)(0);
        let rDcShort = (0, helper_1.bn)(0);
        let supplyDetails = {};
        let rDetails = {};
        for (let pool of pools) {
            rC = pool.states.rC;
            rDcLong = pool.states.rA;
            rDcShort = pool.states.rB;
            rDetails[pool.k.toNumber()] = pool.states.rA;
            rDetails[-pool.k.toNumber()] = pool.states.rB;
            supplyDetails[pool.k.toNumber()] = pool.states.sA;
            supplyDetails[-pool.k.toNumber()] = pool.states.sB;
        }
        return {
            supplyDetails,
            rDetails,
            R: rC.add(rDcLong).add(rDcShort),
            rC,
            rDcLong,
            rDcShort,
        };
    }
    parseDdlLogs(ddlLogs) {
        const eventInterface = new ethers_1.ethers.utils.Interface(this.profile.getAbi('Events'));
        const topics = (0, helper_1.getTopics)();
        return ddlLogs.map((log) => {
            if (!topics.Derivable.includes(log.topics[0]) && !topics.Swap.includes(log.topics[0]) && !topics.Transfer.includes(log.topics[0])) {
                return {};
            }
            try {
                const decodeLog = eventInterface.parseLog(log);
                let appName = '';
                try {
                    appName = ethers_1.ethers.utils.parseBytes32String(decodeLog.args.topic1);
                }
                catch (e) {
                }
                let data = decodeLog;
                if (appName === 'PoolCreated') {
                    const poolCreatedData = utils_1.defaultAbiCoder.decode(this.profile.getEventDataAbi()[appName], decodeLog.args.data);
                    data = {
                        ...poolCreatedData,
                        TOKEN_R: ethers_1.ethers.utils.getAddress('0x' + decodeLog.args.topic3.slice(-40)),
                    };
                }
                return {
                    address: data.poolAddress,
                    contractAddress: log.address,
                    timeStamp: parseInt(log.timeStamp),
                    transactionHash: log.transactionHash,
                    blockNumber: log.blockNumber,
                    index: log.logIndex,
                    logIndex: log.transactionHash + '-' + log.logIndex,
                    name: appName,
                    topics: log.topics,
                    data: log.data,
                    args: {
                        ...data,
                    },
                };
            }
            catch (e) {
                console.error(e);
                return {};
            }
        });
    }
    _tokenInRoutes() {
        return Object.keys(this.profile.routes).reduce((results, pair) => {
            return [...results, ...pair.split('-')];
        }, []);
    }
    _whitelistTokens() {
        const result = [];
        const tokens = this.profile.configs.tokens;
        for (let address in tokens) {
            result.push({
                address,
                logo: tokens[address].logo,
                name: tokens[address].name,
                symbol: tokens[address].symbol,
                decimal: tokens[address].decimals,
            });
        }
        return result;
    }
    //@ts-ignore
    async getPrices(pools, pairs) {
        const blockNumber = await this.overrideProvider.getBlockNumber();
        const promises = Object.values(pools).filter((pool) => pool.FETCHER !== constant_1.ZERO_ADDRESS).map((pool) => {
            return this.getPrice(pool, blockNumber, pairs[pool.pair]);
        });
        const result = {};
        const res = await Promise.all(promises);
        res.forEach((priceInfo) => {
            result[priceInfo.poolAddress] = { spot: priceInfo.spot, twap: priceInfo.twap };
        });
        return result;
    }
    async getPrice(pool, blockNumber, pair) {
        const getStorageAt = OracleSdkAdapter.getStorageAtFactory(this.overrideProvider);
        const getBlockByNumber = OracleSdkAdapter.getBlockByNumberFactory(this.overrideProvider);
        const twap = await OracleSdk.getPrice(getStorageAt, getBlockByNumber, pool.pair, pool.quoteTokenIndex, blockNumber - (pool.window.toNumber() >> 1));
        let spot;
        const [r0, r1] = [pair.token0.reserve, pair.token1.reserve];
        if (pool.quoteTokenIndex == 0) {
            spot = r0.shl(128).div(r1);
        }
        else {
            spot = r1.shl(128).div(r0);
        }
        return {
            poolAddress: pool.poolAddress,
            twap: twap.shl(16),
            spot: twap.eq(0) ? (0, helper_1.bn)(0) : spot
        };
    }
    getSingleRouteToUSD(token, types = ['uniswap3']) {
        const { routes, configs: { stablecoins } } = this.profile;
        for (const stablecoin of stablecoins) {
            for (const asSecond of [false, true]) {
                const key = asSecond ? stablecoin + '-' + token : token + '-' + stablecoin;
                const route = routes[key];
                if (route?.length != 1) {
                    continue;
                }
                const { type, address } = route[0];
                if (!types.includes(type)) {
                    continue;
                }
                const quoteTokenIndex = token.localeCompare(stablecoin, undefined, { sensitivity: 'accent' }) < 0
                    ? 1 : 0;
                return {
                    quoteTokenIndex,
                    stablecoin,
                    address,
                };
            }
        }
        return undefined;
    }
}
exports.Resource = Resource;
//# sourceMappingURL=resource.js.map