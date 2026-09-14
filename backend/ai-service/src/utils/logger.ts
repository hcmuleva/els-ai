type LogFields = Record<string, unknown>;

function line(level: string, msg: string, fields?: LogFields) {
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
  info: (msg: string, fields?: LogFields) => line("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => line("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => line("error", msg, fields),
  debug: (msg: string, fields?: LogFields) => {
    if (process.env.NODE_ENV !== "production") line("debug", msg, fields);
  },
};
