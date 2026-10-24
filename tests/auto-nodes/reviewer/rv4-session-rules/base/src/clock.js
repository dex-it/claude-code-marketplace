let fixed = null
export const now = () => fixed ?? Date.now()
export const setNow = (t) => { fixed = t }
