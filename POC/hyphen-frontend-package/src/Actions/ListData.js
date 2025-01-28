export const setListData = payload =>{
    return {
        type: 'LIST_DATA',
        ...payload
    }
}