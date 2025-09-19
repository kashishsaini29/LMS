import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './db/db';
import MainRouter from './routes/index.route';
import { ErrorMiddleware } from './middlewares/error';
import {v2 as cloudinary} from "cloudinary"

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,
})
console.log('Cloudinary Config:', cloudinary.config());

const PORT = parseInt(process.env.PORT || "9000", 10);
const app = express();

// body parser
app.use(express.json({limit:"50mb"}));

// cookie parser
app.use(cookieParser());

// cross origin resource sharing
app.use(cors({                            
    origin:process.env.ORIGIN,
    credentials: true                         
}));                    


app.use('/LMS/V1', MainRouter);

// unknown route
app.all("*", (req:Request,res:Response, next:NextFunction)=>{
    const err= new Error(`Route ${req.originalUrl} not found`) as any;
    err.statusCode= 404;
    next(err)
});

app.use(ErrorMiddleware);

app.listen(PORT,()=>{
    console.log("listening on port: ",PORT);
})
