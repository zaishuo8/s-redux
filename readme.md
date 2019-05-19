# 文档

s-redux 是一个最简单版的 redux, 尝试实现一下 reducer、action、dispatch 和中间件等最基本的功能, 文章记录下自己的思考过程 🤔

## 实现基本 api (createStore, subscribe, dispatch)

先看下官网的第一个示例

```
const { createStore } = require('redux');

function counter(state = 0, action) {
    switch (action.type) {
        case 'INCREMENT':
            return state + 1;
        case 'DECREMENT':
            return state - 1;
        default:
            return state;
    }
}

let store = createStore(counter);

store.subscribe(() =>
    console.log(store.getState())
);

store.dispatch({ type: 'INCREMENT' });
// 1
store.dispatch({ type: 'INCREMENT' });
// 2
store.dispatch({ type: 'DECREMENT' });
// 1
```

createStore 方法接收 reducer 参数, 返回 { subscribe, getState, dispatch }

```
function createStore(reducer) {
    return {
        subscribe,
        getState,
        dispatch
    }
}
```

- getState: 返回 state
- subscribe: 把订阅的函数存进一个数组, dispatch 的时候遍历执行
- dispatch: 修改 state, 并遍历执行订阅函数

```
function createStore(reducer, initState) {
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

module.exports = {
    createStore
};
```

用上面的示例代码测试一下，可行

## combineReducers

官网的第二个示例

```
const { combineReducers, createStore } = require('../lib/redux');

function visibilityFilter(state = 'SHOW_ALL', action) {
    switch (action.type) {
        case 'SET_VISIBILITY_FILTER':
            return action.filter;
        default:
            return state;
    }
}

function todos(state = [], action) {
    switch (action.type) {
        case 'ADD_TODO':
            return [
                ...state,
                {
                    text: action.text,
                    completed: false
                }
            ];
        case 'COMPLETE_TODO':
            return state.map((todo, index) => {
                if (index === action.index) {
                    return Object.assign({}, todo, {
                        completed: true
                    })
                }
                return todo;
            });
        default:
            return state;
    }
}

let reducer = combineReducers({ visibilityFilter, todos });

let store = createStore(reducer);

store.subscribe(() =>
    console.log(store.getState())
);

store.dispatch({
    type: 'ADD_TODO',
    text: 'first todo'
});

store.dispatch({
    type: 'ADD_TODO',
    text: 'second todo'
});

store.dispatch({
    type: 'COMPLETE_TODO',
    index: 1
});

store.dispatch({
    type: 'SET_VISIBILITY_FILTER',
    filter: 'SHOW_COMPLETED'
});
```

- combineReducers 接收参数 { reducer, reducer }, 返回一个合并后的 reducer
- 合并后的 reducer 中, 遍历每个小的 reducer, 执行 action
- state 也得合并, 执行小的 reducer 时用对应的 state, 最后合并 state 返回

```
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
```

## 中间件

希望达到的效果，在示例1的基础上加一些中间件

```
const { createStore, applyMiddleware } = require('redux');

const middleware1 = store => next => action => {
    console.log('1. ', action, 'state', store.getState());
    next(action);
    console.log('4. ', action, 'state', store.getState());
};

const middleware2 = store => next => action => {
    console.log('2. ', action, 'state', store.getState());
    next(action);
    console.log('3. ', action, 'state', store.getState());
};

function counter(state = 0, action) {
    switch (action.type) {
        case 'INCREMENT':
            return state + 1;
        case 'DECREMENT':
            return state - 1;
        default:
            return state;
    }
}

let store = createStore(
    counter,
    0,
    applyMiddleware(middleware1, middleware2)
);

store.subscribe(() =>
    console.log('subscriber: ' + store.getState())
);

store.dispatch({ type: 'INCREMENT' });
```

执行后控制台打印

```
1.  { type: 'INCREMENT' } state 0
2.  { type: 'INCREMENT' } state 0
subscriber: 1
3.  { type: 'INCREMENT' } state 1
4.  { type: 'INCREMENT' } state 1
```

看结果，redux 的中间件是一个类似 koa 的洋葱圈模型

中间件函数是个链式的箭头函数 `middle = store => next => action => {}`, 改成 es5 的写法就是

```
function middle(store) {
    return function(next) {
        return function(action) {
            // ...
        }
    }
}
```

- applyMiddleware 方法，返回的是一个函数，暂且叫它 rebuild 函数，该函数用来改造 createStore 的
- 当 createStore(reducer, initState, rebuild) 有 rebuild 参数时，就 rebuild(createStore)
- rebuild 函数接收老的 createStore 函数，返回新的 createStore 函数
- 新的 createStore 函数也是返回 { getState, subscribe, dispatch }

重点：

- 新的 createStore 修改 dispatch 方法，将 middleware 中的方法体从后往前一层层替换上来, 假设有 3 个中间件, 则
    - middlewares[2] 中的 next 是 dispatch
    - middlewares[1] 中的 next 是 middlewares[2] 的方法体
    - middlewares[0] 中的 next 是 middlewares[1] 的方法体

```
// 参数是 旧createStore
// const middlewares = [ middle1, middle2, middl3 ];
function build(createStore) {

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
```

改写一下 createStore

```
function createStore(reducer, initState, rebuild) {
    ...
    
    if(rebuild) {
        const newCreateStore = rebuild(createStore);
        return newCreateStore(reducer, initState);
    }
    
    ...
}
```

用测试代码测试一下，达到效果

## ToDo List

- thunkMiddleware
- react-redux API

## 参考资料

- https://github.com/brickspert/blog/issues/22
- https://www.redux.org.cn/docs/advanced/Middleware.html

























