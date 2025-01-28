const loggerFunnctions = {
  1: "error",
  2: "warn",
  3: "info",
  4: "log",
};

const loggerMessagePrefix = {
  1: "ERROR",
  2: "WARNING",
  3: "DEBUG",
  4: "VERBOSE",
};
const logMessage = (level, message = "No Message Provided", value = "") => {
  const fnName = loggerFunnctions[level];
  const messagePrefix = loggerMessagePrefix[level];
  console[fnName](`${messagePrefix}: ${message}`, value);
};

export const error = (message, value) => {
  logMessage(1, message, value);
};
export const warn = (message, value) => {
  logMessage(2, message, value);
};
export const info = (message, value) => {
  logMessage(3, message, value);
};
export const verbose = (message, value) => {
  logMessage(4, message, value);
};
