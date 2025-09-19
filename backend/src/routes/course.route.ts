import express from 'express';
import { authorizeRoles, isAuthenticated } from '../middlewares/auth.middleware';
import { uploadCourse } from '../repository/course.repository';

const Course = express.Router();


Course.post("/create-course",isAuthenticated,authorizeRoles("admin"),uploadCourse);

export default Course;