"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const boards_1 = require("../../constants/boards");
const getTickerOptions = (assets) => {
    const acceptedAssets = assets.filter(item => {
        if (!item?.[12] && item[0] && item[1])
            return false;
        return boards_1.ACCEPTED_BOARDS.includes(item?.[12]);
    });
    const tickerOptions = acceptedAssets.map(item => ({
        ticker: item[0],
        name: item[1],
        boardName: item[12] ?? item[13]
    }));
    return tickerOptions;
};
const acceptedAssets = async (fastify, opts) => {
    fastify.get('/', async function (request, reply) {
        const { search } = request.query;
        const res = await fetch(`https://iss.moex.com/iss/securities.json?q=${search}`);
        const data = await res.json();
        const tickerOptions = getTickerOptions(data.securities.data);
        reply.send(JSON.stringify({ tickerOptions }));
    });
};
exports.default = acceptedAssets;
//# sourceMappingURL=index.js.map