import { createClient } from '@supabase/supabase-js'
import { FastifyPluginAsync, RouteGenericInterface } from 'fastify'
import { Database } from '../../types/supabase'

const getMoexBoardLink = (secid: string, boardName: string) => {
  if (boardName === "CETS") {
    return `https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`
  }

  return `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${boardName}/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`
}

interface GetAssetsData {
  userId: string
}

interface MyRouteGeneric extends RouteGenericInterface {
  Querystring: GetAssetsData;
}

interface AddAsset {
  userId: string
  ticker: string
  name: string
  category: string
  comment: string
  sector: string
  quantity: number
  boardName: string
}

interface EditQuantity {
  assetId: string
  quantity: number
}

interface EditAsset {
  assetId: string
  category: string
  sector: string
  comment: string
}

interface DeleteAsset {
  assetId: string
}

interface DeleteGeneric extends RouteGenericInterface {
  Querystring: DeleteAsset;
}
type UserAssetsWithoutPrices = Omit<Database["public"]["Tables"]["user-assets"]["Row"], "user_id" | "created_at">
type AssetResponse = UserAssetsWithoutPrices & Partial<{
  price: number
  totalPrice: number
  changePercent: number
}>

const getAssetResponseIfError = (reason: string, assetDataWithoutPrices: UserAssetsWithoutPrices) => {
  return {
    price: 0,
    totalPrice: 0,
    changePercent: 0,
    boardName: assetDataWithoutPrices.boardName,
    category: assetDataWithoutPrices.category,
    id: assetDataWithoutPrices.id,
    name: assetDataWithoutPrices.name,
    quantity: assetDataWithoutPrices.quantity,
    sector: assetDataWithoutPrices.sector,
    ticker: assetDataWithoutPrices.ticker,
    comment: assetDataWithoutPrices.comment,
    errorReason: reason,
  }
}

const getAssetResponseType = (asset: AssetResponse) => {
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
    errorReason: "",
  }
}

const supabase = createClient<Database>(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");

const isMarketDataCorrect = (data: unknown): data is { marketdata: { columns: string[], data: unknown[] } } => {
  typeof data === 'object' && data !== null && "marketdata" in data
  return typeof data === 'object' && data !== null && "marketdata" in data && typeof data.marketdata === 'object' && data.marketdata !== null && "columns" in data.marketdata && Array.isArray(data.marketdata.columns) && "data" in data.marketdata && Array.isArray(data.marketdata.data)
}

const MOEX_FETCH_TIMEOUT_MS = 8_000

const getAssetDataPromise = async (assetData: Database["public"]["Tables"]["user-assets"]["Row"]): Promise<AssetResponse> => {
  const { ticker, boardName } = assetData
  if (!ticker || !boardName) return {
    ...assetData,
    price: 0,
    totalPrice: 0,
    changePercent: 0,
  }
  const boardLink = getMoexBoardLink(ticker, boardName)
  console.info("boardLink", boardLink, ticker, boardName);
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MOEX_FETCH_TIMEOUT_MS)

  const moexResp = await fetch(boardLink, {
    credentials: "omit",
    signal: controller.signal,
  }
  )
  clearTimeout(timeoutId)
  console.info("moexResp", moexResp);
  const data = await moexResp.json();
  console.info("data", data);
  const columns: string[] = isMarketDataCorrect(data) ? data?.marketdata?.columns : []
  const dataRows: any[] = isMarketDataCorrect(data) ? data?.marketdata?.data : []
  const marketPriceIdx = columns.indexOf('MARKETPRICE')
  const lastPriceIdx = columns.indexOf('LAST')
  const lastToPrevPriceIdx = columns.indexOf('LASTTOPREVPRICE')
  const row = Array.isArray(dataRows) && dataRows.length > 0 ? dataRows[0] : undefined

  const marketPrice = marketPriceIdx !== -1 && row ? Number(row[marketPriceIdx]) : NaN
  const last = lastPriceIdx !== -1 && row && Number(row[lastPriceIdx]) > 0 ? Number(row[lastPriceIdx]) : marketPrice
  const prcnt = (lastToPrevPriceIdx !== -1 && row ? Number(row[lastToPrevPriceIdx]) : NaN) ?? 0

  const stringifiedTotalPrice = (last * (assetData.quantity || 0)).toFixed(2)
  return {
    ...assetData,
    price: last,
    totalPrice: +stringifiedTotalPrice,
    changePercent: prcnt,
  }

}

function isConnectTimeout(error: unknown): boolean {
  const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : null
  return typeof cause === 'object' && cause !== null && 'code' in cause && (cause as { code?: string }).code === 'UND_ERR_CONNECT_TIMEOUT'
}

async function retry<T>(fn: () => Promise<T>, retriesLeft = 2, interval = 200): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retriesLeft === 0) {
      throw new Error(`Max retries exceeded. Last error: ${error}`);
    }
    if (isConnectTimeout(error)) {
      console.log('Connect timeout to MOEX, skipping retries (likely unreachable from this region).');
      throw error;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
    console.log(`Retrying failed promise... ${retriesLeft} attempts left.`);
    return retry(fn, retriesLeft - 1, interval);
  }
}

const userAssets: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<MyRouteGeneric>('/', async function (request, reply) {
    const { userId } = request.query

    try {
      const { data: userAssetsFromDB, error: userAssetsError } = await supabase
        .from('user-assets')
        .select('*')
        .eq('user_id', userId)

      if (userAssetsError) throw userAssetsError;

      if (!Array.isArray(userAssetsFromDB)) throw "Ошибка получения данных для этого пользователя"
      try {
        const userAssetsWithPrice = await Promise.allSettled(userAssetsFromDB.map(async (assetData) => {
          const promiseCallback = () => getAssetDataPromise(assetData)
          return retry(promiseCallback)
        }))

        const userAssets = userAssetsWithPrice.map((promiseResult, index) => {
          if (promiseResult.status === "fulfilled") {
            return getAssetResponseType(promiseResult.value)
          }

          return getAssetResponseIfError(JSON.stringify(promiseResult.reason), userAssetsFromDB[index])
        })

        reply.send({ userAssets });
      } catch (err) {
        reply.code(400).send({
          error: `Ошибка при получении данных с московской биржи`,
          err,
        });
      }
    } catch (err) {
      reply.code(400).send({
        error: `Ошибка получения данных для этого пользователя`,
        err,
      });
    }
  })

  fastify.post<{ Body: AddAsset }>('/add-asset', async function (request, reply) {
    const { userId, ticker, name, category, sector, quantity, boardName, comment } = request.body;

    // Проверяем наличие обязательных полей
    if (!userId || !ticker || !name || !category || !sector || typeof quantity !== 'number' || !boardName) {
      return reply.code(400).send({ error: `Недостаточно данных!, userId:${!userId}, ticker:${!ticker}, name: ${!name}, category:${!category}, sector: ${!sector}, quantity: ${typeof quantity !== 'number'}, boardName: ${!boardName}` });
    }

    try {
      const { data: existingRecord, error: selectError } = await supabase
        .from('user-assets')
        .select('*')
        .eq('user_id', userId)
        .eq('ticker', ticker)

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
          .single()

        if (error) throw error;
        reply.send({ message: 'Актив успешно добавлен!', data });
      } else {
        reply.code(400).send({
          error: `Данные для этого актива уже существуют`,
          existingRecord,
          selectError
        });
      }

    } catch (err) {
      console.error(JSON.stringify(err)); // Логируем ошибку
      reply.code(500).send({ error: JSON.stringify(err) });
    }
  })

  fastify.patch<{ Body: EditQuantity }>('/edit-asset-quantity', async function (request, reply) {
    const { assetId, quantity } = request.body
    const { data, error } = await supabase
      .from('user-assets')
      .update({
        quantity
      })
      .eq('id', assetId)
      .select()
      .single()

    if (error) {
      return reply.status(500).send(error);
    }
    const updatedAsset = getAssetResponseType(data)
    return reply.send(updatedAsset);
  })

  fastify.patch<{ Body: EditAsset }>('/edit-asset', async function (request, reply) {
    const { assetId, sector, comment, category } = request.body
    const { data, error } = await supabase
      .from('user-assets')
      .update({
        sector,
        comment,
        category
      })
      .eq('id', assetId)
      .select()
      .single()

    if (error) {
      return reply.status(500).send(error);
    }

    const updatedAsset = getAssetResponseType(data)
    return reply.send(updatedAsset);
  })

  fastify.delete<DeleteGeneric>('/delete-asset', async function (request, reply) {
    const { assetId } = request.query

    const { data, error } = await supabase
      .from('user-assets')
      .delete()
      .eq('id', assetId)

    if (error) {
      return reply.status(500).send(error);
    }

    return reply.send(data);
  })
}

export default userAssets