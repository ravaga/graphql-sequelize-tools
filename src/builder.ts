
import DatabaseStack from './stack';
import { GraphQLSchema , GraphQLError} from 'graphql'
import { generateSchema, GroupModels } from './gen'
import { GetUser } from './auth';
import { createContext } from 'dataloader-sequelize'

export const ContextBuilder = async (dbs, extend) => {

    return ({ req }) => {

        //try to retrieve auth & getUser functions from extend
        const { getUser, error, auth } = extend;
        let user;

        if ( auth && auth == true) {
            // get the user token from the headers
            const token = req.headers.authentication || '';

            // try to retrieve a user with the token
            user = GetUser(token);

            // optionally block the user
            // we could also check user roles/permissions here
            if (!user) throw new GraphQLError('you must be logged in to query this schema');
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

export const StackBuilder = async (config, extend = null) => {

    //Load Models
    const dbs = await new DatabaseStack(config).expose();

    //Build Context
    const context = await ContextBuilder( dbs , ( extend ? extend : {} ))

    //Build Schemas
    const schemas = await generateSchema(dbs)

    let dataloaderContext = {}
    
    for(let key in dbs){
        let cntx = createContext( dbs[key].sequelize );
        dataloaderContext = {
            ...dataloaderContext,
            ...cntx
        }
    }

    return {
        context,
        schema: new GraphQLSchema(schemas),
        models:GroupModels(dbs),
    }
}