export default function ErrorReducer(state = {}, action) {
  const { type, error } = action;
  const matches = /(.*)_(REQUEST|FAILED|ERROR|SUBMIT|OTP_SCREEN|CHANGE)/.exec(
    type
  );
  if (!matches) return state;
  const [, requestName, requestState] = matches;
  return {
    errorMessage:
      requestState === "FAILED" || requestState === "ERROR"
        ? error
          ? error
          : ""
        : "",
    [requestName]: requestState === "FAILED" || requestState === "ERROR" ? true : false
  };
}
