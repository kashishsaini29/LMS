import {Response} from "express";
import Course from "../repository/schema/course";
import { CatchAsyncError } from "../middlewares/catchAsyncErrors";

//create course

export const createCourse = CatchAsyncError(async(data:any,res:Response)=>{
    const course = await Course.create(data);
    res.status(200).json({
        success:true,
        course
    })
})