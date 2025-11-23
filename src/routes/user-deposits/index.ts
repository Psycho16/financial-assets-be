import { createClient } from "@supabase/supabase-js";
import { FastifyPluginAsync, RouteGenericInterface } from "fastify";
import { Database } from "../../types/supabase";

interface GetDepositsData {
  userId: string
}

interface MyRouteGeneric extends RouteGenericInterface {
  Querystring: GetDepositsData;
}

interface AddDeposit {
  userId: string
  name: string
  endDate: string
  amount: number
  ratePercent: number
}

interface DeleteAsset {
  depositId: string
}

interface EditDepositAmount {
  depositId: string
  amount: number
}

interface EditDeposit {
  depositId: string
  name: string
  endDate: string
  ratePercent: number
}

interface DeleteGeneric extends RouteGenericInterface {
  Querystring: DeleteAsset;
}

type DepositResponse = Omit<Database["public"]["Tables"]["user-deposits"]["Row"], "user_id" | "created_at"> & Partial<{
}>

const getDepositResponseType = (deposit: DepositResponse) => {
  return {
    amount: deposit.amount,
    id: deposit.id,
    name: deposit.name,
    endDate: deposit.end_date,
    ratePercent: deposit.rate_percent,
  }
}

const supabase = createClient<Database>(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");

const userDeposits: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<MyRouteGeneric>('/', async function (request, reply) {
    const { userId } = request.query

    try {
      const { data, error: userDepositsError } = await supabase
        .from('user-deposits')
        .select('*')
        .eq('user_id', userId)

      if (userDepositsError) throw userDepositsError;
      const userDeposits = data.map(item => {
        return getDepositResponseType(item)
      })
      reply.send({ userDeposits });
    } catch (err) {
      reply.code(400).send({
        error: `Ошибка при получении данных из базы данных`,
        err,
      });
    }
  }

  )

  fastify.post<{ Body: AddDeposit }>('/add-deposit', async function (request, reply) {
    const { userId, name, endDate, amount, ratePercent } = request.body;

    // Проверяем наличие обязательных полей
    if (!userId || !endDate || !name || !amount || !ratePercent) {
      return reply.code(400).send({ error: `Недостаточно данных!, userId:${!userId}, endDate:${!endDate}, name: ${!name}, amount:${!amount}, ratePercent: ${!ratePercent}` });
    }

    try {

      const { data, error } = await supabase.from('user-deposits').insert({
        user_id: userId,
        name,
        rate_percent: ratePercent,
        amount,
        end_date: endDate,
      });

      if (error) throw error;

      reply.send({ message: 'Вклад успешно добавлен!', data });
    } catch (err) {
      console.error(JSON.stringify(err)); // Логируем ошибку
      reply.code(500).send({ error: JSON.stringify(err) });
    }
  })

  fastify.patch<{ Body: EditDepositAmount }>('/edit-deposit-amount', async function (request, reply) {
    const { depositId, amount } = request.body
    const { data, error } = await supabase
      .from('user-deposits')
      .update({
        amount
      })
      .eq('id', depositId)
      .select()
      .single()

    if (error) {
      return reply.status(500).send(error);
    }

    const updatedDeposit = getDepositResponseType(data)
    return reply.send(updatedDeposit);
  })

  fastify.patch<{ Body: EditDeposit }>('/edit-deposit', async function (request, reply) {
    const { depositId, endDate, ratePercent, name } = request.body
    const { data, error } = await supabase
      .from('user-deposits')
      .update({
        name,
        end_date: endDate,
        rate_percent: ratePercent
      })
      .eq('id', depositId)
      .select()
      .single()

    if (error) {
      return reply.status(500).send(error);
    }

    const updatedDeposit = getDepositResponseType(data)
    return reply.send(updatedDeposit);
  })

  fastify.delete<DeleteGeneric>('/delete-deposit', async function (request, reply) {
    const { depositId } = request.query

    const { data, error } = await supabase
      .from('user-deposits')
      .delete()
      .eq('id', depositId)

    if (error) {
      return reply.status(500).send(error);
    }

    return reply.send({ message: 'Вклад успешно удален!', data });
  })
}

export default userDeposits