
import DatabaseStack from './stack';
import { GraphQLSchema } from 'graphql'
import { createContext } from 'dataloader-sequelize'
import { generateSchema, GroupModels } from './gen'

export const ContextBuilder = async (dbs, extend) => {

    return ({ req }) => {

        //try to retrieve auth & getUser functions from extend
        const { getUser, error, auth } = extend;
        let user;

        if (auth && auth == true) {
            // get the user token from the headers
            const token = req.headers.authentication || '';

            // try to retrieve a user with the token
            user = getUser(token);

            // optionally block the user
            // we could also check user roles/permissions here
            if (!user) throw new error('you must be logged in to query this schema');
        }
        else {
            
            return {
                user: user || null,
                ...extend,
                dbs
            }
        }

    }
}

// ~! TODO
export const ResolverBuilder = (models) => {

    return //merge(...loadResolversFiles( __dirname + '/resolver/' ))

}

// ~! TODO
export const TypeDefsBuilder = async (models) => {

    return //gql(loadSchemaFiles( __dirname + '/schema/').join('\n') )

}

export const StackBuilder = async (config, extend = null) => {

    //Load Models
    const dbs = await new DatabaseStack(config).expose();

    //Build Context
    const context = await ContextBuilder( dbs , ( extend ? extend : {} ))

    const schemas = await generateSchema(dbs)

    //Build TypeDefs
    const typeDefs = {};//await TypeDefsBuilder( dbs ); 

    //Build Resolvers
    const resolvers = {};//await ResolverBuilder( dbs )

    // let dataloaderContext = {};
            
    //         for(let key in dbs)
    //         {
    //             let db = dbs[key].sequelize;
    //             let cntx = createContext(db);

    //             dataloaderContext = {
    //                 ...dataloaderContext,
    //                 ...cntx
    //             }
    //         }

    return {
        context,
        schema: new GraphQLSchema(schemas),
    }
}