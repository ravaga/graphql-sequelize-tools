import * as fs from "fs"
import { join , dirname } from "path"
import { DataBaseModel } from './';

export default class DatabaseStack {
    
    public dbs: any
    private root: string 

    constructor(dbs: any) {
        this.dbs = {};
        this.root = dirname(require.main.filename || process.mainModule.filename )
        
        this.init(dbs);
    }

    private init(dbs){        
        Object.keys(dbs).map(k => {
            const db = dbs[k];
            this.dbs[k] = this.setup(db)
        });

    }

    private setup(db: any) {
        return new DataBaseModel(db).dir( join(this.root, "models", db.dir )) ;
    }

    public associate() {
        Object.keys(this.dbs).map(k => {
            this.dbs[k].associate(this.dbs[k], this.dbs)
        });
        return this.dbs;
    }

    public expose() {
        return this.associate()
    }
}