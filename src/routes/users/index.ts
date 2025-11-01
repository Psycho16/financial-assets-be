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

const supabase = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");

const users: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post<{ Body: SignUp }>('/sign-up', async function (request, reply) {
    const { email, password } = request.body
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
      },
    })

    if (error) {
      return reply.status(500).send(error);
    }
    console.log('email, password', { email, password })
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

  fastify.get('/', async function (request, reply) {
    const { data, error } = await supabase
      .from('your_table_name') // Замените на имя вашей таблицы
      .select('*');


    if (error) {
      return reply.status(500).send(error);
    }

    return reply.send(data);
  })

}

export default users
