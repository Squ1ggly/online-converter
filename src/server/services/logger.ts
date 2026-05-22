type Level = "INFO" | "WARN" | "ERROR";
type Fields = Record<string, string | number | boolean | undefined>;

function log(level: Level, msg: string, fields?: Fields): void {
  const ts = new Date().toISOString();
  const fieldStr = fields
    ? " " + Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";
  const line = `${ts} [${level.padEnd(5)}] ${msg}${fieldStr}`;
  level === "ERROR" ? console.error(line) : level === "WARN" ? console.warn(line) : console.log(line);
}

export const logger = {
  info:  (msg: string, fields?: Fields) => log("INFO",  msg, fields),
  warn:  (msg: string, fields?: Fields) => log("WARN",  msg, fields),
  error: (msg: string, fields?: Fields) => log("ERROR", msg, fields),
};
