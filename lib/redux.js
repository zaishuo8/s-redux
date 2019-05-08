function createStore(reducer, initState, rebuild) {
    if(rebuild) {
        const newCreateStore = rebuild(createStore);
        return newCreateStore(reducer, initState);
    }

    let state = initState;
    const subscribers = [];

    function getState() {
        return state;
    }

    function subscribe(fn) {
        subscribers.push(fn);
    }

    function dispatch(action) {
        // 直接用 reducer 执行 action 就能得到新的 state
        state = reducer(state, action);
        // 遍历执行订阅函数
        subscribers.forEach(subscriber => { subscriber() });
    }

    return {
        subscribe,
        getState,
        dispatch
    }
}

function combineReducers(reducers) {
    return function(state = {}, action) {
        const newState = {};
        Object.keys(reducers).forEach(reducerName => {
            const reducer = reducers[reducerName];
            const partState = state[reducerName];
            newState[reducerName] = reducer(partState, action);
        });
        return newState;
    }
}

function applyMiddleware(...middlewares) {

    // return 的就是 rebuild 函数
    return function(createStore) {

        // 返回 新createStore
        return function(reducer, initState) {
            // 先通过 旧createStore 生成一个 store
            const store = createStore(reducer, initState);
            let dispatch = store.dispatch;

            // 下面对 dispatch 进行层层迭代
            const chain = middlewares.map(middleware => middleware(store));
            // 此时 chain 里面是 [next => action => {}], 用于生成 dispatch
            chain.reverse().forEach(dispatchGenerator => {
                dispatch = dispatchGenerator(dispatch);
            });

            // 此时的 dispatch 已经套上了 middlewares 中的方法体, 赋值给 store.dispatch
            store.dispatch = dispatch;

            return store;
        }
    }
}

module.exports = {
    createStore,
    combineReducers,
    applyMiddleware
};
