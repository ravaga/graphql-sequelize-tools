
import jwt from "jsonwebtoken"
require('dotenv').config();

export const GetUser = token => {
    try {
        if (token) {
            return jwt.verify( token , process.env.JWT_SECRET_KEY , {
                ignoreExpiration: process.env.NODE_ENV !== "production"
            })
        }
        return null
    } catch (err) {
        return null
    }
}