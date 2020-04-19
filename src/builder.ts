
import DatabaseStack from './stack';
import ResolverModel from './resolver';

export const ContextBuilder = async ( models , extend = {} ) => {    
    return ({ req }) => {
        return {
            ...extend,
            models,
            resolve: ResolverModel
        }
    }
}

// ~! TODO
export const ResolverBuilder = ( models ) => {

    return //merge(...loadResolversFiles( __dirname + '/resolver/' ))

}

// ~! TODO
export const TypeDefsBuilder = async ( models ) => {

    return //gql(loadSchemaFiles( __dirname + '/schema/').join('\n') )

}

export const StackBuilder = async (config) => {

    const { extend } = config;

    //Load Models
    const models = await new DatabaseStack( config ).expose();
    
    //Build Context
    const context = await ContextBuilder( models , ( extend ? extend : {} ) )
    
    //Build TypeDefs
    const typeDefs = {};//await TypeDefsBuilder( models ); 
    
    //Build Resolvers
    const resolvers = {};//await ResolverBuilder( models )

    return {
        context,
        typeDefs,
        resolvers
    }
}