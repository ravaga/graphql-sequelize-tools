
import * as fs from "fs"
import { join } from "path"
import { Sequelize } from "sequelize"

export default class DataBaseModel {

    public name: string
    public db: any
    public sequelize: any

    public constructor(config) {

        this.name = config.database
        this.db = {};

        this.db.asssociate = this.associate
        this.sequelize = new Sequelize(config.database, config.user, config.password, {
            host: config.host,
            port: config.port,
            dialect: config.dialect || "mysql",
            pool: config.pool || {
                max: 10,
                min: 2,
                idle: 10000
            },
            define: {
                timestamps: config.timestamps || false
            },
            logging: false//config.log || console.log
        });

        try {
            this.sequelize.authenticate();
        } catch (error) {
            console.error("Unable to connect to the database:", error);
        }
        this.sequelize.dialect.supports.schemas = true;
    }

    public dir(path) {
        return this.modelPath(path);
    }

    public modelPath(p) {

        let files = fs.readdirSync(p)
            .filter((file) => {
                return (file.indexOf(".") !== 0) &&
                    (file !== "index.js") &&
                    (!fs.lstatSync(join(p, file)).isDirectory()) &&
                    (file.indexOf(".map") <= 0)

            })
            .forEach((file) => {
                const model = this.sequelize.import(join(p, file));
                this.db[model.name] = model;
            });
        this.db.sequelize = this.sequelize
        this.db.Sequelize = Sequelize
        return this.db
    }

    public associate(db, relatives) {
        Object.keys(db).forEach((modelName) => {
            if ("associate" in db[modelName]) {
                db[modelName].associate(db, relatives);
            }
        })
        return db;
    }
}