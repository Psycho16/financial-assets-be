'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const Fastify = require('fastify');
const closeWithGrace = require('close-with-grace');
const app = Fastify({
    logger: true
});
const appService = require('./app.js');
app.register(appService);
closeWithGrace({ delay: process.env.FASTIFY_CLOSE_GRACE_DELAY || 500 }, async function ({ signal, err, manual }) {
    if (err) {
        app.log.error(err);
    }
    await app.close();
});
app.listen({ port: process.env.PORT || 3000 }, (err) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }
});
//# sourceMappingURL=server.js.map