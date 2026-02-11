"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const getMoexBoardLink = (secid, boardName) => {
    if (boardName === "CETS") {
        return `https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`;
    }
    return `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${boardName}/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`;
};
const getAssetResponseIfError = (reason) => {
    return {
        price: 0,
        totalPrice: 0,
        changePercent: 0,
        boardName: "none",
        category: "none",
        id: "none",
        name: "none",
        quantity: 0,
        sector: "none",
        ticker: "none",
        comment: reason,
    };
};
const getAssetResponseType = (asset) => {
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
        comment: asset.comment,
    };
};
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");
const isMarketDataCorrect = (data) => {
    typeof data === 'object' && data !== null && "marketdata" in data;
    return typeof data === 'object' && data !== null && "marketdata" in data && typeof data.marketdata === 'object' && data.marketdata !== null && "columns" in data.marketdata && Array.isArray(data.marketdata.columns) && "data" in data.marketdata && Array.isArray(data.marketdata.data);
};
const getAssetDataPromise = async (assetData) => {
    const { ticker, boardName } = assetData;
    if (!ticker || !boardName)
        return {
            ...assetData,
            price: 0,
            totalPrice: 0,
            changePercent: 0,
        };
    const boardLink = getMoexBoardLink(ticker, boardName);
    console.info("boardLink", boardLink, ticker, boardName);
    const moexResp = await fetch(boardLink, {
        headers: {
            "Access-Control-Allow-Origin": "*"
        }
    });
    console.info("moexResp", moexResp);
    const data = await moexResp.json();
    console.info("data", data);
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
};
async function retry(fn, retriesLeft = 3, interval = 200) {
    try {
        return await fn();
    }
    catch (error) {
        if (retriesLeft === 0) {
            throw new Error(`Max retries exceeded. Last error: ${error}`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
        console.log(`Retrying failed promise... ${retriesLeft} attempts left.`);
        return retry(fn, retriesLeft - 1, interval);
    }
}
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
                const userAssetsWithPrice = await Promise.allSettled(userAssetsFromDB.map(async (assetData) => {
                    const promiseCallback = () => getAssetDataPromise(assetData);
                    return retry(promiseCallback);
                }));
                const userAssets = userAssetsWithPrice.map((promiseResult) => {
                    if (promiseResult.status === "fulfilled") {
                        return getAssetResponseType(promiseResult.value);
                    }
                    console.info('promiseResult reason', promiseResult.reason);
                    return getAssetResponseIfError(promiseResult.reason);
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
    fastify.post('/add-asset', async function (request, reply) {
        const { userId, ticker, name, category, sector, quantity, boardName, comment } = request.body;
        if (!userId || !ticker || !name || !category || !sector || typeof quantity !== 'number' || !boardName) {
            return reply.code(400).send({ error: `Недостаточно данных!, userId:${!userId}, ticker:${!ticker}, name: ${!name}, category:${!category}, sector: ${!sector}, quantity: ${typeof quantity !== 'number'}, boardName: ${!boardName}` });
        }
        try {
            const { data: existingRecord, error: selectError } = await supabase
                .from('user-assets')
                .select('*')
                .eq('user_id', userId)
                .eq('ticker', ticker);
            if (!existingRecord?.length) {
                const { data, error } = await supabase.from('user-assets')
                    .insert({
                    user_id: userId,
                    ticker,
                    name,
                    category,
                    sector,
                    quantity,
                    comment,
                    boardName
                })
                    .select()
                    .single();
                if (error)
                    throw error;
                reply.send({ message: 'Актив успешно добавлен!', data });
            }
            else {
                reply.code(400).send({
                    error: `Данные для этого актива уже существуют`,
                    existingRecord,
                    selectError
                });
            }
        }
        catch (err) {
            console.error(JSON.stringify(err));
            reply.code(500).send({ error: JSON.stringify(err) });
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
            .select()
            .single();
        if (error) {
            return reply.status(500).send(error);
        }
        const updatedAsset = getAssetResponseType(data);
        return reply.send(updatedAsset);
    });
    fastify.patch('/edit-asset', async function (request, reply) {
        const { assetId, sector, comment, category } = request.body;
        const { data, error } = await supabase
            .from('user-assets')
            .update({
            sector,
            comment,
            category
        })
            .eq('id', assetId)
            .select()
            .single();
        if (error) {
            return reply.status(500).send(error);
        }
        const updatedAsset = getAssetResponseType(data);
        return reply.send(updatedAsset);
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