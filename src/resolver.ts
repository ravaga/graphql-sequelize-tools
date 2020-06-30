export default class ResolverModel {
    _model_: any
    _pKey_:string
    _args_: {
        distinct: boolean,
        include: any,
        where: object,
        order: number,
        limit: number,
        offset: number,
        skip: number
    }
    args: any
    type: string
    result: any
    find: any

    constructor( model , args) {
        this._model_ = model;
        this.result = undefined;
        let q = this.buildArgs(args)
        this.args = q
    }

    buildArgs(q) {
        console.log('THIS ARGS', q );
        q = q || {}
        let { distinct, include, where, order, limit, skip , primary_key } = q
        this._pKey_ = primary_key ? primary_key : 'id' 
        where = where ? where : {}

        return {
            distinct: distinct ? distinct : true,
            include: include ? include : null,
            where: where ? where : {},
            order: order ? order : [
                [ primary_key , 'DESC' ],
            ],
            limit: limit ? limit : 100,
            offset: skip ? skip : 0
        }
    }

    async findByID(id) {
        return await this._model_.findByPk(id)
    }

    async findAllAndExec(_func_) {

        let data = await this._model_.findAll(this.args);
        return _func_(data)
    }

    async findAll() {
        let result = await this._model_.findAll(this.args)
        return result
    }

    exec(_func_) {
        return _func_(this._model_)
    }
}