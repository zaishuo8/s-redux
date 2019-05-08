const { createStore, applyMiddleware } = require('../lib/redux');


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
