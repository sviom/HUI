const Vue = require('vue');
const App = require('../src/App.vue');
const Router = require('./routes');

new Vue({
    el: "#app",
    Router,
    // store,
    render: h => h(App)
});