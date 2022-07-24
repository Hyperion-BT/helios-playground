import {ce, assertDefined} from "./util.js";
import {DB} from "./DB.js";
import {App} from "./App.js";

const root = ReactDOM.createRoot(document.getElementById('root'));

async function launch() {
	let db = await DB.open();
	root.render(ce(App, {db: assertDefined(db)}));
}

async function main() {
	let query = await navigator.permissions.query({ name: 'clipboard-write', allowWithoutGesture: false });

	if (query.state == "granted") {
		await launch();
	} else if (query.state == "prompt") {
		query.onchange = () => {
			void launch();	
		};
	} else {
		console.error("clipboard copy/cut access denied");

		await launch();
	}
}

void main();
