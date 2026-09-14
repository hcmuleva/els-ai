function line(level, msg, fields) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        msg,
        ...fields,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
}
export const logger = {
    info: (msg, fields) => line("info", msg, fields),
    warn: (msg, fields) => line("warn", msg, fields),
    error: (msg, fields) => line("error", msg, fields),
    debug: (msg, fields) => {
        if (process.env.NODE_ENV !== "production")
            line("debug", msg, fields);
    },
};
//# sourceMappingURL=logger.js.map