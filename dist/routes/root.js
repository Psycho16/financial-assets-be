"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const root = async (fastify, opts) => {
    fastify.get('/', async function (request, reply) {
        return { root: false };
    });
};
exports.default = root;
//# sourceMappingURL=root.js.map