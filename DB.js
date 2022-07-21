const DB_VERSION = 1;

class CachedData {
    constructor(nonce, data) {
        this.nonce_ = nonce;
        this.data_ = data;
    }

    get data() {
        return this.data_;
    }

    isUpToDate(nonce) {
        return this.nonce_ == nonce;
    }

    update(nonce, fn) {
        if (nonce != this.nonce_) {
            let ret = fn(this.data_);
            if (ret != undefined) {
                this.data_ = ret;
            }
        }
    }
}

// read methods can be used synchronously (cached data is returned)
// write methods are always async
export class DB {
    constructor(idb) {
        this.idb_ = idb; // indexedDB

        this.nonce_ = 0n; // increment upon every write operation
        this.filesCache_ = new CachedData(-1n, new Map());
    }

    incrNonce() {
        this.nonce_ += 1n;
    }

    // return Promise<Map<int, Object>>
    getFiles() {
        return new Promise(
            (resolve, reject) => {
                let transaction = this.idb_.transaction(["files"], "readonly");
                let store = transaction.objectStore("files");

                let request = store.openCursor();

                request.onerror = (e) => {
                    reject(e);
                }

                let result = new Map();

                request.onsuccess = (e) => {
                    let cursor = e.target.result;

                    if (cursor != null) {
                        result.set(cursor.key, cursor.value);

                        cursor.continue();
                    } else {
                        this.filesCache_.update(this.nonce_, () => result);

                        resolve(result);
                    }
                }
            }
        );
    }

    // callback is used when cache isn't up-to-date
    getFilesSync(callback = () => {}) {
        if (!this.filesCache_.isUpToDate(this.nonce_)) {
            this.getFiles().then(callback);
        }

        return this.filesCache_.data;
    }

    // return Promise<Int>
    newFile() {
        return new Promise(
            (resolve, reject) => {
                // add to db immediately
                let transaction = this.idb_.transaction(["files"], "readwrite");
                let store = transaction.objectStore("files");

                let obj = {name: "untitled", data: "test untitled;"};
                let request = store.add(obj);

                request.onerror = (e) => {
                    reject(e);
                }

                request.onsuccess = (e) => {
                    this.incrNonce();

                    let key = e.target.result;

                    this.filesCache_.update(this.nonce_, (files) => {
                        files.set(key, obj);
                    });
                    
                    resolve(key);
                }
            }
        );
    }

    // returns Promise<void>
    setFile(key, name, data) {
        return new Promise(
            (resolve, reject) => {        
                let transaction = this.idb_.transaction(["files"], "readwrite");
                let store = transaction.objectStore("files");

                let obj = {name: name, data: data};
                let request = store.put(obj, key);

                request.onerror = (e) => {
                    reject(e);
                }

                request.onsuccess = (e) => {
                    this.incrNonce();
                    
                    this.filesCache_.update(this.nonce_, (files) => {
                        files.set(key, obj);
                    });

                    resolve();
                }
            }
        );
    }

    // returns Promise<DB>
    static open() {
        return new Promise(
            (resolve, reject) => {    
                let request = indexedDB.open("helios-playground", DB_VERSION);
        
                request.onerror = function(e) {
                    reject(e);
                }
        
                request.onsuccess = function(e) {
                    resolve(new DB(e.target.result));
                }
        
                request.onupgradeneeded = function(e) {
                    let db = e.target.result;
        
                    // create the tables
                    if (e.oldVersion < 1) {
                        db.createObjectStore("files", {autoIncrement: true});
                    }
                }
            }
        );
    }
}