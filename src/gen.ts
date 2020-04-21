export default class RslvGenerator {
    
    public config: any
    public db: string
    public obj: any

    constructor(config: any) {
        this.config = config
        this.db = config.db
        this.obj = {}
        return this  
    }

    public getObj(){
        return this.obj
    }
    public generate(obj){
    
        this.obj = {
            Query:{},
            Mutation:{}
        }

        let keys = Object.keys( obj)
        let crud = ['create', 'update', 'delete']

        keys.map( k => {
            
            const model = obj[k]
            let byID = {}
            const primary_key = model.key ? model.key : 'id'
            byID[primary_key]

            //Singular GetByID
            this.obj.Query[`${k}`] = async ( _ , args , {models, resolve}) => {  
                let db = model.db ? model.db : this.db;
                return await new resolve( models[`${db}`][`${k}`],  {primary_key:primary_key})
                    .findByID( args.where[`${primary_key}`] )
            }
            //Plural FindAll
            this.obj.Query[`${k}s`] = async ( _ , args , {models, resolve} ) => {
                let db = model.db ? model.db : this.db;
                return await new resolve( models[`${db}`][`${k}`], {primary_key:primary_key} ).findAll()
            }

            //Mutations
            const y = k.charAt(0).toUpperCase() + k.slice(1)
            crud.map( c => {
                this.obj.Mutation[`${c}${y}`] = async ( _ , args , cntx, resolve ) =>{
                    return await new resolve( cntx.models[`${this.db}`][`${k}`])[`${c}`](args)
                }
            })

            let { associations } = model;

            if(associations)
            {

                let { extend } = associations;

                this.obj[`${y}`] = {}
                let { findAll , findOne } = associations;
                if(findOne && findOne.length >= 1)
                {
                    findOne.map( assoc => {
                        let as = assoc.as ? `${assoc.as}` : `${assoc.model}` 
                        this.obj[`${y}`][as] = async ( root , args, {models}) => {
                            let w = {}
                            w[`${assoc.keys[0]}`] = root[`${assoc.keys[1]}`]
                            let db = assoc.db ? assoc.db : this.db;
                            return await models[`${db}`][`${assoc.model}`].findOne({where:{...w}})
                        }
                   }) 
                }

                if(findAll && findAll.length >= 1)
                {
                    findAll.map( assoc => {
                        let as = assoc.as ? `${assoc.as}` : `${assoc.model}` 
                        this.obj[`${y}`][as] = async ( root , args, {models}) => {
                            let w = {}
                            w[`${assoc.keys[0]}`] = root[`${assoc.keys[1]}`]
                            let db = assoc.db ? assoc.db : this.db;
                            let submodel = await models[`${db}`][`${assoc.model}`].findAll({where:{...w}})
                            return submodel
                        }
                   }) 
                }

                if(extend)
                {
                    let extendKeys = Object.keys(extend)
                    if(extendKeys.length >= 1)
                    {
                        extendKeys.map( ek =>{
                            this.obj[`${y}`][ek] = extend[ek]
                        })
                    }
                }

            }
        })
        return this
    }

    public extend( obj : any ){

        let extensions = ['Query', 'Mutation'];

        extensions.map( e => {

            if( obj[e] !== undefined )
            {
                let keys = Object.keys( obj[e] );
                if(keys.length >= 1)
                {
                    keys.map( k => {

                        if(typeof obj[e][k] === 'function')
                        {
                            this.obj[ e ][ k ] = obj[e][k]
                        }
                    })
                }
            }
        });
        return this
    }
}