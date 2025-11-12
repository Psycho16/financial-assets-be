"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");
const users = async (fastify, opts) => {
    fastify.post('/sign-up', async function (request, reply) {
        const { email, password } = request.body;
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });
        if (error) {
            return reply.status(500).send(error);
        }
        return reply.send(data);
    });
    fastify.post('/verify-email', async function (request, reply) {
        const { token } = request.body;
        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
        });
        if (error) {
            return reply.status(500).send(error);
        }
        return reply.send(data);
    });
    fastify.post('/sign-in', async function (request, reply) {
        const { email, password } = request.body;
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        if (error) {
            return reply.status(500).send(error);
        }
        return reply.send(data);
    });
    fastify.post('/add-asset', async function (request, reply) {
        const { userId, ticker, name, category, sector, quantity, boardName } = request.body;
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
                const { data, error } = await supabase.from('user-assets').insert({
                    user_id: userId,
                    ticker,
                    name,
                    category,
                    sector,
                    quantity,
                    boardName
                });
                if (error)
                    throw error;
                reply.send({ message: 'Данные успешно добавлены!', data });
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
};
exports.default = users;
//# sourceMappingURL=index.js.map