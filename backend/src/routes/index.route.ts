
import express from "express";
import Account from "./account.route";
import Course from "./course.route";
const MainRouter= express.Router();

MainRouter.use("/account",Account)
MainRouter.use("/course",Course);

export default MainRouter;