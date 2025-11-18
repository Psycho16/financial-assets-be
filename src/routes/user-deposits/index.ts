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
  endDate: string // ISO date string
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

interface DeleteGeneric extends RouteGenericInterface {
  Querystring: DeleteAsset;
}

const supabase = createClient<Database>(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");

const userDeposits: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get<MyRouteGeneric>('/', async function (request, reply) {
    const { userId } = request.query

    try {
      const { data: userDeposits, error: userDepositsError } = await supabase
        .from('user-deposits')
        .select('*')
        .eq('user_id', userId)

      if (userDepositsError) throw userDepositsError;

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

    if (error) {
      return reply.status(500).send(error);
    }

    return reply.send(data);
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