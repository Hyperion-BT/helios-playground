import {ce, assertDefined, SHARE_URL} from "./util.js";
import {DB} from "./DB.js";
import {App} from "./App.js";
import {AppData} from "./AppData.js";

const root = ReactDOM.createRoot(document.getElementById('root'));

function loadShare(key) {
	return new Promise((resolve, reject) => {
		// get the data from aws
		let reqObj = {
			"action": "get",
			"key": key
		};

		let req = new XMLHttpRequest();

		req.onerror = (e) => {
			reject(e);
		};

		req.onload = (_) => {
			if (req.status == 200) {
				let respObj = JSON.parse(req.responseText);

				let data = respObj.data;

				if (data === undefined) {
					reject(new Error("Response format error"));
				} else {
					resolve(data); // string
				}
			} else {
				reject(new Error(req.responseText));
			}
		}

		req.open("POST", SHARE_URL);
		req.setRequestHeader("Content-Type", "application/json");
		req.send(JSON.stringify(reqObj));
	});
}

async function launch() {
	let db = assertDefined(await DB.open());

	// see if share is defined in
	let params = (new URL(window.location)).searchParams;

	let shareKey = params.get("share");

	let initKey = null;

	if (shareKey !== null && shareKey != "") {
		let shareData = await loadShare(shareKey);

		let currentFiles = await db.getFiles();
		
		let foundKey = -1;
		for (let [currentKey, currentFile] of currentFiles) {
			if (currentFile.data == shareData) {
				foundKey = currentKey;
				break;
			}
		}

		if (foundKey == -1) {
			foundKey = await db.newFile();

			await db.setFile(foundKey, shareData);
		}

		initKey = foundKey;
	} 

	root.render(ce(App, {db: db, data: await AppData.new(db, initKey)}));
}

async function main() {
	try {
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
	} catch(_) {
		void launch();
	}
}

void main();
