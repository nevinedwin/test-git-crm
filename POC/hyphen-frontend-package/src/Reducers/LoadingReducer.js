export default function LoadingReducer(state = {}, action) {
    const { type } = action;
    const matches = /(.*)_(REQUEST|SUCCESS|FAILED|ERROR|SUBMIT)/.exec(type);
    if (!matches) return state;
    const [, requestName, requestState] = matches;
    return {
        ...state,
        [requestName]: (requestState === 'REQUEST' || requestState === 'SUBMIT')
    };

}
