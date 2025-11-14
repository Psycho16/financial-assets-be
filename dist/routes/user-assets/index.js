"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const getMoexBoardLink = (secid, boardName) => {
    if (boardName === "CETS") {
        return `https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`;
    }
    return `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${boardName}/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`;
};
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");
const isMarketDataCorrect = (data) => {
    typeof data === 'object' && data !== null && "marketdata" in data;
    return typeof data === 'object' && data !== null && "marketdata" in data && typeof data.marketdata === 'object' && data.marketdata !== null && "columns" in data.marketdata && Array.isArray(data.marketdata.columns) && "data" in data.marketdata && Array.isArray(data.marketdata.data);
};
const userAssets = async (fastify, opts) => {
    fastify.get('/', async function (request, reply) {
        const { userId } = request.query;
        try {
            const { data: userAssetsFromDB, error: userAssetsError } = await supabase
                .from('user-assets')
                .select('*')
                .eq('user_id', userId);
            if (userAssetsError)
                throw userAssetsError;
            if (!Array.isArray(userAssetsFromDB))
                throw "Ошибка получения данных для этого пользователя";
            try {
                const userAssetsWithPrice = await Promise.all(userAssetsFromDB.map(async (assetData) => {
                    const { ticker, boardName } = assetData;
                    if (!ticker || !boardName)
                        return {
                            ...assetData,
                            price: 0,
                            totalPrice: 0,
                            changePercent: 0,
                        };
                    const boardLink = getMoexBoardLink(ticker, boardName);
                    const moexResp = await fetch(boardLink);
                    const data = await moexResp.json();
                    const columns = isMarketDataCorrect(data) ? data?.marketdata?.columns : [];
                    const dataRows = isMarketDataCorrect(data) ? data?.marketdata?.data : [];
                    const marketPriceIdx = columns.indexOf('MARKETPRICE');
                    const lastPriceIdx = columns.indexOf('LAST');
                    const lastToPrevPriceIdx = columns.indexOf('LASTTOPREVPRICE');
                    const row = Array.isArray(dataRows) && dataRows.length > 0 ? dataRows[0] : undefined;
                    const marketPrice = marketPriceIdx !== -1 && row ? Number(row[marketPriceIdx]) : NaN;
                    const last = lastPriceIdx !== -1 && row && Number(row[lastPriceIdx]) > 0 ? Number(row[lastPriceIdx]) : marketPrice;
                    const prcnt = (lastToPrevPriceIdx !== -1 && row ? Number(row[lastToPrevPriceIdx]) : NaN) ?? 0;
                    const stringifiedTotalPrice = (last * (assetData.quantity || 0)).toFixed(2);
                    return {
                        ...assetData,
                        price: last,
                        totalPrice: +stringifiedTotalPrice,
                        changePercent: prcnt,
                    };
                }));
                const userAssets = userAssetsWithPrice.map((asset) => {
                    return {
                        price: asset.price,
                        totalPrice: asset.totalPrice,
                        changePercent: asset.changePercent,
                        boardName: asset.boardName,
                        category: asset.category,
                        id: asset.id,
                        name: asset.name,
                        quantity: asset.quantity,
                        sector: asset.sector,
                        ticker: asset.ticker,
                    };
                });
                reply.send({ userAssets });
            }
            catch (err) {
                reply.code(400).send({
                    error: `Ошибка при получении данных с московской биржи`,
                    err,
                });
            }
        }
        catch (err) {
            reply.code(400).send({
                error: `Ошибка получения данных для этого пользователя`,
                err,
            });
        }
    });
    fastify.patch('/edit-asset-quantity', async function (request, reply) {
        const { assetId, quantity } = request.body;
        const { data, error } = await supabase
            .from('user-assets')
            .update({
            quantity
        })
            .eq('id', assetId)
            .select();
        if (error) {
            return reply.status(500).send(error);
        }
        return reply.send(data);
    });
    fastify.delete('/delete-asset', async function (request, reply) {
        const { assetId } = request.query;
        const { data, error } = await supabase
            .from('user-assets')
            .delete()
            .eq('id', assetId);
        if (error) {
            return reply.status(500).send(error);
        }
        return reply.send(data);
    });
};
exports.default = userAssets;
//# sourceMappingURL=index.js.map