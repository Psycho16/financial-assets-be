"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const getMoexBoardLink = (secid, boardName) => {
    if (boardName === "CETS") {
        return `https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`;
    }
    return `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${boardName}/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`;
};
const DB = {
    "1": {
        ticker: "SBERP",
        quantity: 1200,
        userCategory: "Акции",
        boardName: "TQBR",
    }
};
const userAssets = async (fastify, opts) => {
    fastify.get('/', async function (request, reply) {
        const { secId } = request.query;
        const boardLink = getMoexBoardLink(secId, "TQBR");
        const moexResp = await fetch(boardLink);
        const data = await moexResp.json();
        reply.send(data);
    });
};
exports.default = userAssets;
//# sourceMappingURL=index.js.map