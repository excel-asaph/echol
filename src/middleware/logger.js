"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = logger;
function logger(req, res, next) {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
}
