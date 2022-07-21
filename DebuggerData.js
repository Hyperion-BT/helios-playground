export class DebuggerData {
    constructor(db) {
        this.db_ = db;

        // only debug scripts in the database        
    }

    static new(db) {
        return new DebuggerData(db);
    }
}