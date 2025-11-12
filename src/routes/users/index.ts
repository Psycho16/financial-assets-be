import { createClient } from '@supabase/supabase-js';
import { FastifyPluginAsync } from 'fastify'

interface SignUp {
  email: string
  password: string
}

interface VerifyEmail {
  token: string
}

interface SignIn {
  email: string
  password: string
}

interface AddAsset {
  userId: string
  ticker: string
  name: string
  category: string
  sector: string
  quantity: number
  boardName: string
}

const supabase = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");

const users: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Body: SignUp }>('/sign-up', async function (request, reply) {
    const { email, password } = request.body

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    if (error) {
      return reply.status(500).send(error);
    }

    return reply.send(data);
  })

  fastify.post<{ Body: VerifyEmail }>('/verify-email', async function (request, reply) {
    const { token } = request.body
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'signup'
    })

    if (error) {
      return reply.status(500).send(error);
    }
    return reply.send(data);
  })

  fastify.post<{ Body: SignIn }>('/sign-in', async function (request, reply) {
    const { email, password } = request.body
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      return reply.status(500).send(error);
    }

    return reply.send(data);
  })

  fastify.post<{ Body: AddAsset }>('/add-asset', async function (request, reply) {
    const { userId, ticker, name, category, sector, quantity, boardName } = request.body;

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
        const { data, error } = await supabase.from('user-assets').insert({
          user_id: userId,
          ticker,
          name,
          category,
          sector,
          quantity,
          boardName
        });

        if (error) throw error;
        reply.send({ message: 'Данные успешно добавлены!', data });
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

}

export default users
