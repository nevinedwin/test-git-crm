export const ManageLocalStorage = {
    get(key) {
        if (!key) {
            return;
        }
        return localStorage.getItem(key);
    },
    set(key, data) {
        if (!key) {
            return;
        }
        data = (data) ? data : {};
        data = typeof data === "string" ? data : JSON.stringify(data);
        localStorage.setItem(key, data);
    },
    delete(key) {
        if (!key) {
            return
        }
        localStorage.removeItem(key);
    },
    clear(){
        localStorage.clear();
    }
};
