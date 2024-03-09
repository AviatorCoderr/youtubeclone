import dotenv from "dotenv"
import mongoose, { mongo } from "mongoose";
import {DB_NAME} from "./constants.js" ;
import connectDB from  "./db/index.js"

dotenv.config({
    path: './env'
})

connectDB
.then(() => {
    app.on("error", (err) => {
        console.log("error in app running ", err)
        throw err
    })
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is running at: ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.log("Mongodb connection failed !!!", err)
})









/*import express from "express";
const app = express();

( async () => {
    try{
        mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", () => {
            console.log("Error", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`listening on port ${process.env.PORT}`)
        })
    }
    catch(error){
        console.error("Error: ", error)
        throw err
    }
})()*/