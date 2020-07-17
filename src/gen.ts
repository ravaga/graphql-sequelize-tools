import * as fs from 'fs'
import { join,  dirname } from "path"
import { GraphQLObjectType, GraphQLInputObjectType, GraphQLList, GraphQLInt, GraphQLString, GraphQLNonNull } from 'graphql'
import { resolver, attributeFields, defaultListArgs, defaultArgs } from 'graphql-sequelize'
import { EXPECTED_OPTIONS_KEY } from 'dataloader-sequelize'
import _ from 'lodash'
import * as helper from './helpers'

// Dir for customs graphs
const customQueryPath = join( dirname( require.main.filename ) , 'custom' )
// Cache fix
let cache = {}

// Dataloader ⭐️
resolver.contextToOptions = {
    dataloaderContext: [EXPECTED_OPTIONS_KEY]
}

/**
 * Returns the association fields of an entity.
 *
 * It iterates over all the associations and produces an object compatible with GraphQL-js.
 * BelongsToMany and HasMany associations are represented as a `GraphQLList` whereas a BelongTo
 * is simply an instance of a type.
 * @param {*} associations A collection of sequelize associations
 * @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
 */
export const generateAssociationFields = (associations, types, isInput = false) => {
    let fields = {}
    for (let associationName in associations) {
        const relation = associations[associationName]
        // BelongsToMany is represented as a list, just like HasMany
        const type = relation.associationType === 'BelongsToMany' ||
            relation.associationType === 'HasMany'
            ? new GraphQLList(types[relation.target.name])
            : types[relation.target.name]

        fields[associationName] = { type }

        if (!isInput) {
            // GraphQLInputObjectType do not accept fields with resolve
            fields[associationName].resolve = resolver(relation)
        }
    }
    return fields
}

/**
 * Returns a new `GraphQLObjectType` created from a sequelize model.
 *
 * It creates a `GraphQLObjectType` object with a name and fields. The
 * fields are generated from its sequelize associations.
 * @param {*} model The sequelize model used to create the `GraphQLObjectType`
 * @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
 */
const TypeName = (modelName) => {

    let pieces = modelName.split('_');
    let name = '';
    if (pieces.length > 1) {
        name = pieces.map( n => _.startCase( _.toLower(n) ) ).join('');
    }
    else
    {
        name = _.startCase( modelName ).split(' ').map( n => n ).join('');
    }

    return name.split(' ').map( n => n ).join('');
}

export const generateGraphQLType = (model, types, isInput = false) => {
    const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType

    let typeName = TypeName(model.name); //model.name.split('_').map( n => _.startCase(_.toLower(n))  ).join('').replace(' ', '')

    return new GraphQLClass({
        name: isInput ? `${typeName}Input` : typeName,
        fields: () => Object.assign(
            attributeFields(model, {
                exclude: ['contrasena'],
                allowNull: !!isInput,
                cache
            }),
            generateAssociationFields(model.associations, types, isInput)
        ),
        description: `The name of the model is ${model.name}, this comment is generated automatically.`
    })
}

/**
 * Returns a collection of `GraphQLObjectType` generated from Sequelize models.
 *
 * It creates an object whose properties are `GraphQLObjectType` created
 * from Sequelize models.
 * @param {*} models The sequelize models used to create the types
 */
export const generateModelTypes = models => {
    let outputTypes = {}
    let inputTypes = {}

    for (let modelName in models) {
        // Only our models, not Sequelize or sequelize
        if (models[modelName].hasOwnProperty('name') && modelName !== 'Sequelize' && modelName !== 'sequelize' && modelName !== 'Op' && modelName !== 'associate') {
            outputTypes[modelName] = generateGraphQLType(
                models[modelName],
                outputTypes
            )
            inputTypes[modelName] = generateGraphQLType(
                models[modelName],
                inputTypes,
                true
            )
        }
    }

    return { outputTypes, inputTypes }
}

export const infoType = new GraphQLObjectType({
    name: 'info',
    fields: () => ({
        total: { type: GraphQLInt },
        pageSize: { type: GraphQLInt },
        page: { type: GraphQLInt },
    }),
    description: 'Type for api pagination'
})

/**
 * Returns a root `GraphQLObjectType` used as query for `GraphQLSchema`.
 *
 * It creates an object whose properties are `GraphQLObjectType` created
 * from Sequelize models.
 * @param {*} models The sequelize models used to create the root `GraphQLSchema`
 */
export const generateQueryRootType = (models, outputTypes) => {
    let fields = Object.keys(outputTypes).reduce((fields, modelTypeName) => {
        const modelType = outputTypes[modelTypeName]

        return Object.assign(fields, {
            [_.lowerFirst(modelType.name)]: {
                type: new GraphQLList(modelType),
                args: Object.assign(
                    defaultArgs(models[modelTypeName]),
                    defaultListArgs()
                ),
                resolve: resolver(models[modelTypeName])
            },
            [_.lowerFirst(modelType.name + 'Pagination')]: {
                type: new GraphQLObjectType({
                    name: modelType.name + 'Result',
                    fields: () => ({
                        info: {
                            type: infoType
                        },
                        results: {
                            type: new GraphQLList(modelType)
                        }
                    })
                }),
                args: Object.assign(
                    defaultArgs(models[modelTypeName]),
                    {
                        page: {
                            type: GraphQLInt
                        },
                        pageSize: {
                            type: GraphQLInt
                        },
                        order: {
                            type: new GraphQLList(new GraphQLList(GraphQLString))
                        }
                    }
                ),
                resolve: (parent, args, context) => {
                    let options = {}
                    if (args['where']) {
                        let whereObjectParsed = args['where']
                        for (var key in args['where']) {
                            var value = args['where'][key]
                            if (value && typeof value === 'string' && value.includes('%')) {
                                whereObjectParsed[key] = { [models.Op.like]: value }
                            }
                        }

                        options['where'] = whereObjectParsed
                    }

                    if (args['order']) {
                        options['order'] = args['order']
                    }

                    options['limit'] = args['pageSize'] ? parseInt(args['pageSize']) : 10
                    options['offset'] = args['page'] ? (args['page'] - 1) * options['limit'] : 0

                    if (!options[EXPECTED_OPTIONS_KEY]) {
                        options[EXPECTED_OPTIONS_KEY] = context['dataloaderContext'] || context
                    }

                    return models[modelTypeName].findAndCountAll(options).then(result => ({
                        info: {
                            total: result.count,
                            pageSize: options['limit'],
                            page: args['page'] || 1
                        },
                        results: result.rows
                    }))
                }
            }
        })
    }, {})


    let customQueries = {}
    if (fs.existsSync(`${customQueryPath}/query`)) {
        fs.readdirSync(`${customQueryPath}/query`)
            .filter(file => file.slice(-3) === '.ts')
            .forEach((file) => {
                let objQuery = require(`${customQueryPath}/query/${file}`)

                if (!objQuery['name']) objQuery['name'] = file.replace('.ts', '')

                customQueries[objQuery['name']] = objQuery.default
            })
    }

    return new GraphQLObjectType({
        name: 'Root_Query',
        fields: Object.assign( fields , customQueries )
    })
}

export const generateMutationRootType = (models, inputTypes, outputTypes) => {
    let fields = Object.keys(inputTypes).reduce(
        (fields, inputTypeName) => {

            if (inputTypeName !== 'associate') {

                const inputType = inputTypes[inputTypeName]
                const key = models[inputTypeName].primaryKeyAttributes[0]
                // TODO: Deep hasmany associations
                const includeArrayModels = getDeepAssociations(inputTypeName, models)

                // UpperCase 
                let inputTypeNameUpperCase = inputTypeName.split('_').map((s, i) => i == 0 ? s : _.upperFirst(s)).join('')

                const toReturn = Object.assign(fields, {
                    [inputTypeNameUpperCase + 'Create']: {
                        type: outputTypes[inputTypeName], // what is returned by resolve, must be of type GraphQLObjectType
                        description: 'Create a ' + inputTypeName,
                        args: {
                            [inputTypeName]: { type: inputType }
                        },
                        resolve: (source, args, context, info) => {
                            return models[inputTypeName].create(args[inputTypeName], { include: includeArrayModels })
                        }
                    },
                    [inputTypeNameUpperCase + 'Update']: {
                        type: outputTypes[inputTypeName],
                        description: 'Update a ' + inputTypeName,
                        args: {
                            [inputTypeName]: { type: inputType }
                        },
                        resolve: (source, args, context, info) => {
                            let options = {
                                where: {
                                    [key]: args[inputTypeName][key]
                                },
                                include: includeArrayModels
                            }

                            if (!options[EXPECTED_OPTIONS_KEY]) {
                                options[EXPECTED_OPTIONS_KEY] = context['dataloaderContext'] || context
                            }

                            // [INFO] Si se manda detalles actualizar los detalles tambien (includes)
                            return models[inputTypeName].findOne(options).then(object2Update => {
                                let promises = []
                                includeArrayModels.forEach(m => {
                                    let model = m.model
                                    if (model.options && model.options.name && model.options.name.plural) {
                                        if (model.options.name.plural in args[inputTypeName]) {
                                            promises.push(helper.upsertArray(model.options.name.plural, args[inputTypeName][model.options.name.plural], object2Update, `${inputTypeName}_id`, args[inputTypeName][key], m.include, models))
                                        }
                                    }
                                })

                                // Actualizar datos
                                promises.push(object2Update.update(args[inputTypeName]))

                                return Promise.all(promises).then(ups => {
                                    // `boolean` equals the number of rows affected (0 or 1)
                                    return resolver(models[inputTypeName])(
                                        source,
                                        options.where,
                                        context,
                                        info
                                    )
                                })
                            })
                        }
                    },
                    [inputTypeNameUpperCase + 'Delete']: {
                        type: GraphQLInt,
                        description: 'Delete a ' + inputTypeName,
                        args: {
                            [key]: { type: new GraphQLNonNull(GraphQLInt) }
                        },
                        resolve: (value, where) => models[inputTypeName].destroy({ where }) // Returns the number of rows affected (0 or 1)
                    }
                })
                return toReturn
            }
        },
        {}
    )

    let customQueries = {}
    if (fs.existsSync(`${customQueryPath}/mutation`)) {
        fs.readdirSync(`${customQueryPath}/mutation`)
            .filter(file => file.slice(-3) === '.ts')
            .forEach((file) => {
                let objQuery = require(`${customQueryPath}/mutation/${file}`)

                if (!objQuery['name']) objQuery['name'] = file.replace('.ts', '')

                customQueries[objQuery['name']] = objQuery
            })
    }

    return new GraphQLObjectType({
        name: 'Root_Mutations',
        fields: Object.assign(fields, customQueries)
    })
}

export const getDeepAssociations = (modelName, models) => {
    const associations = models[modelName].associations,
        includeArrayModels = []

    for (let associationName in associations) {
        const relation = associations[associationName]

        if (relation.associationType === 'HasMany') {
            includeArrayModels.push({ model: models[relation.target.name], include: getDeepAssociations(relation.target.name, models) })
        }
    }

    return includeArrayModels
}

export const GroupModels = (dbs) => {
    let models = {}
    for (let db in dbs) {
        for (let key in dbs[db])

            if ( key !== 'sequelize' && key !== 'Sequelize' && key !== 'Op' && key !== 'associate' )
                models = {
                    ...models,
                    [`${key}`]: dbs[db][key]
                };
    }
    return models
}


// This function is exported
export const generateSchema = async ( dbs , types = null) => {

    let models = GroupModels(dbs)

    const modelTypes = types !== null ? types : generateModelTypes(models)

    const queries = await generateQueryRootType(models, modelTypes.outputTypes)


    const mutations = await generateMutationRootType(
        models,
        modelTypes.inputTypes,
        modelTypes.outputTypes
    )


    return {
        query: queries,
        mutation: mutations
    }
}