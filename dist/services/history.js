"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.History = void 0;
// @ts-nocheck
const ethers_1 = require("ethers");
const constant_1 = require("../utils/constant");
class History {
    constructor(configs) {
        this.account = configs.account;
        this.CURRENT_POOL = configs.CURRENT_POOL;
    }
    formatSwapHistory({ logs, }) {
        try {
            if (!logs || logs.length === 0) {
                return [];
            }
            const swapLogs = logs.map((log) => {
                const encodeData = ethers_1.ethers.utils.defaultAbiCoder.encode(constant_1.EventDataAbis.Swap, log.args.args);
                const formatedData = ethers_1.ethers.utils.defaultAbiCoder.decode(constant_1.EventDataAbis.Swap, encodeData);
                const { poolIn, poolOut } = formatedData;
                const tokenIn = formatedData.sideIn.eq(constant_1.POOL_IDS.native)
                    ? constant_1.NATIVE_ADDRESS
                    : poolIn + '-' + formatedData.sideIn.toString();
                const tokenOut = formatedData.sideOut.eq(constant_1.POOL_IDS.native)
                    ? constant_1.NATIVE_ADDRESS
                    : poolIn + '-' + formatedData.sideOut.toString();
                return Object.assign({ transactionHash: log.transactionHash, timeStamp: log.timeStamp, blockNumber: log.blockNumber, poolIn,
                    poolOut,
                    tokenIn,
                    tokenOut }, formatedData);
            });
            //@ts-ignore
            return swapLogs.sort((a, b) => (b.blockNumber - a.blockNumber));
        }
        catch (e) {
            throw e;
        }
    }
    calculateLeverage(powerState, balances, powers) {
        const _balances = {};
        for (let i in balances) {
            if (powers[i]) {
                _balances[powers[i]] = balances[i];
            }
        }
        return powerState.calculateCompExposure(_balances);
    }
}
exports.History = History;
//# sourceMappingURL=history.js.map