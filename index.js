import {ce, assertDefined} from "./util.js";
import {DB} from "./DB.js";
import {App} from "./App.js";

const root = ReactDOM.createRoot(document.getElementById('root'));

DB.open().then((db) => {
    root.render(ce(App, {db: assertDefined(db)}));
});