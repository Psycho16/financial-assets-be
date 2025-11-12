import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { ACCEPTED_BOARDS } from "../../constants/boards";

type SecuritiesData = {
  securities: {
    columns: string[],
    data: (string[])[]
  }
}

type TickerOption = {
  ticker: string;
  name: string;
  boardName: string;
}

const getTickerOptions = (assets: string[][]): TickerOption[] => {
  const acceptedAssets = assets.filter(item => {
    if (!item?.[12] && item[0] && item[1]) return false
    return ACCEPTED_BOARDS.includes(item?.[12])
  })
  const tickerOptions = acceptedAssets.map(item => ({
    ticker: item[0],
    name: item[3],
    boardName: item[12] ?? item[13]
  }))

  return tickerOptions
}

interface GetAcceptedAssets {
  search: string
}

interface MyRouteGeneric extends RouteGenericInterface {
  Querystring: GetAcceptedAssets;
}

const acceptedAssets: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<MyRouteGeneric>('/', async function (request, reply) {
    const { search } = request.query
    const res = await fetch(`https://iss.moex.com/iss/securities.json?q=${search}`)
    const data
      = await res.json() as SecuritiesData
    const tickerOptions = getTickerOptions(data.securities.data)

    reply.send(JSON.stringify({ tickerOptions }));
  }
  )
}

export default acceptedAssets