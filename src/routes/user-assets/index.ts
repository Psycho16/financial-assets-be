import { FastifyPluginAsync, RouteGenericInterface } from 'fastify'

const getMoexBoardLink = (secid: string, boardName: string) => {
  if (boardName === "CETS") {
    return `https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`
  }

  return `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${boardName}/securities/${encodeURIComponent(secid)}.json?iss.meta=off&iss.only=marketdata&lang=ru`
}

interface GetAssetsData {
  secId: string
}

interface MyRouteGeneric extends RouteGenericInterface {
  Querystring: GetAssetsData;
}

const DB = {
  "1": {
    ticker: "SBERP",
    quantity: 1200,
    userCategory: "Акции",
    boardName: "TQBR",
  }
}

const userAssets: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<MyRouteGeneric>('/', async function (request, reply) {
    const { secId } = request.query
    const boardLink = getMoexBoardLink(secId, "TQBR")
    const moexResp = await fetch(boardLink)

    const data = await moexResp.json();
    reply.send(data);
  })
}

export default userAssets