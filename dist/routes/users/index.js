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
};
exports.default = users;
//# sourceMappingURL=index.js.map