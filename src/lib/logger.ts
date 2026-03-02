import { v4 as uuidv4 } from 'uuid';

export function createLogger(requestId?: string) {
  const id = requestId || uuidv4();
  const log = (level: string, msg: string, meta?: object) =>
    console.log(
      JSON.stringify({ level, requestId: id, msg, ...meta, ts: new Date().toISOString() })
    );
  return {
    id,
    info: (msg: string, meta?: object) => log('info', msg, meta),
    warn: (msg: string, meta?: object) => log('warn', msg, meta),
    error: (msg: string, meta?: object) => log('error', msg, meta),
  };
}
