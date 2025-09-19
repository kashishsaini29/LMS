import Account, { IAccount } from "./schema/accounts.schema";
import bcrypt from "bcryptjs";
import { hash } from "crypto";
import dotenv from "dotenv";
import jwt ,{JwtPayload} from "jsonwebtoken";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middlewares/catchAsyncErrors";
import { NextFunction, Request, Response } from "express";
import ejs from "ejs";
import path from "path";
import {SendMail} from '../utils/sendMail';
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../db/redis";
import { getUserById } from "../service/account.service";
import  {v2 as cloudinary} from "cloudinary";


dotenv.config();

interface IRegistrationBody{
  name:string;
  email:string;
  password:string;
  avatar?:string;
}

interface IActivationToken{
  token:string;
  activationCode :string;
}

const SECRET_KEY = process.env.SECRET_KEY;

export const registrationUser = CatchAsyncError(async(req:Request, res:Response, next:NextFunction)=>{
  try{
    const {name, email, password}= req.body;
    const isEmailExist = await Account.findOne({email});

    if(isEmailExist){
       return next(new ErrorHandler("Email already exists",400));
    };
    const user:IRegistrationBody ={
      name,
      email,
      password,
    };
    const activaitonToken = createActivationToken(user);
    const activationCode = activaitonToken.activationCode;
    const data = {user:{name:user.name}, activationCode};
    const html = await ejs.renderFile(
      path.join(__dirname,"../mails/activationMails.ejs"),
    data
  );
  try{
      await SendMail({
         email:user.email,
         subject:"Activate your account",
         template:"activationMails",
         data,
      });
      res.status(201).json({
        success:true,
        message:`Please check your email: ${user.email} to activate your account`,
        activaitonToken: activaitonToken.token,
      });
  }catch(error:any){
    return next(new ErrorHandler(error.message, 400));
  }
    }catch(error:any){
      return next(new ErrorHandler(error.message,400));
    }
})

export const createActivationToken =(user:any):IActivationToken => {
  if(!SECRET_KEY){
            throw new Error("Secret key is required");
        }
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
  const token = jwt.sign({user, activationCode}, 
    SECRET_KEY,
    {
      expiresIn:"5m",
    })
    return {token, activationCode};
}

interface IActivateRequest{
  activation_token:string;
  activation_code:string;
}

export const ActivateUser = CatchAsyncError(async(req:Request, res:Response, next:NextFunction)=>{
  try{
     const {activation_token, activation_code} = req.body as IActivateRequest;
     const newUser:any=jwt.verify(
      activation_token,
      process.env.SECRET_KEY as string
     );

     if(newUser.activationCode !== activation_code){
      return next(new ErrorHandler("Invalid activation code",400));
     }
     const {name,email,password,role} = newUser.user;

     const existUser = await Account.findOne({email});

     if(existUser){
      return next(new ErrorHandler("User already exists",400));
     }

     const user = await Account.create({
      name,
      email,
      password,
      role,
     })
      res.status(200).json({
        status:"success"
      })

  }catch(error:any){
    return next(new ErrorHandler(error.message,400));
  }
})

interface ILogRequest{
  email:string;
  password:string;
}

export const loginUser= CatchAsyncError(async (req:Request, res:Response, next :NextFunction)=>{
  try{
    const {email,password} =req.body as ILogRequest;
    console.log("email,password",email,password);
    if(!email || !password){
      return next(new ErrorHandler("Please enter email and password",400));
    }
    const user = await Account.findOne({email}).select("+password");
    console.log("User---",user);
    if(!user){
      return next(new ErrorHandler("Invalid email or password",400));
    }

    const isPasswordMatch = await user.comparePassword(password);
     console.log("isPasswordMatch",isPasswordMatch);
    if(!isPasswordMatch){
      return next(new ErrorHandler("Invalid email or password",400));
    };

    sendToken(user, 200, res);

  }catch(error:any){
    return next(new ErrorHandler(error.message,400));
  }
})



// logout user
export interface UserRequest extends Request {
  user?:IAccount
  };

export const logoutUser = CatchAsyncError(
  async(req:any, res:Response, next:NextFunction)=>{
    try{
      res.cookie("access_token","", {maxAge:1});
      res.cookie("refresh_token", "",{maxAge:1});
        
      const userId = req?.user?._id || "";
      console.log("userID",userId);
      redis.del(userId);
      res.status(200).json({
        success:true,
        message:"Logged out successfully"
      })
    }catch(error:any){
      return next(new ErrorHandler(error.message,400));
    }
  }
)


// update access token
export const updateAccessToken = CatchAsyncError(async(req:any, res:Response,next:NextFunction)=>{
  try{
     const refresh_token = req.cookies.refresh_token;
     const decode = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string)as JwtPayload;

     const message ="Could not refresh token";

     if(!decode){
      return next(new ErrorHandler(message,400));
     }
     const session = await redis.get(decode.id as string);

     if(!session){
        return next(new ErrorHandler(message,400));
     }
     const user = JSON.parse(session);

     const accessToken = jwt.sign({id:user._id}, process.env.ACCESS_TOKEN as string,{
      expiresIn:"5m"
     });
     const refreshToken = jwt.sign({id:user._id},process.env.REFRESH_TOKEN as string,{
      expiresIn:'3d'
     });

     req.user = user;
     res.cookie("access_token", accessToken, accessTokenOptions);
     res.cookie("refresh_token", refreshToken, refreshTokenOptions);

     res.status(200).json({
      status:"success",
      accessToken
     })

  }catch(error:any){
    return next(new ErrorHandler(error.message, 400));
  }
})


// get user Info

export const getUserInfo= CatchAsyncError(async(req:any,res:Response, next:NextFunction)=>{
  try{
       const userId = req?.user._id;
    getUserById(userId,res);
  }catch(error:any){
    return next(new ErrorHandler(error.message,400));
  }
})


interface ISocialAuthBody{
  email:string,
  name:string,
  avatar:string,
}

export const socialAuth = CatchAsyncError(async(req:any, res:Response, next:NextFunction)=>{
  try{
      const {email, name, avatar} = req.body as ISocialAuthBody;
      const user = await Account.findOne({email});
      console.log("user",user);
      if(!user){
        const newUser = await Account.create({email, name, avatar});
        console.log("new User",newUser);
        sendToken(newUser,200, res);
      }else{
        sendToken(user,200, res);
      }

  }catch(error:any){
    return next(new ErrorHandler(error.message, 400));
  }
})

interface IUpdateUserInfo{
  email:string,
  name:string
}

export const updateUserInfo = CatchAsyncError(
  async(req:any, res:Response, next:NextFunction)=>{
    try{
       const {email, name} = req.body as IUpdateUserInfo;
       const userId = req.user._id;
       console.log("userId",userId);
       const user = await Account.findById(userId);
           console.log("user",user);
       if(email && user){
        const isEmailExist:any = Account.findOne({email});
        if(isEmailExist){
          return next(new ErrorHandler("Email already exists",400));
        }
        user.email = email
       }

       if(user && name){
        user.name = name
       }
       await user?.save();
       await redis.set(userId,JSON.stringify(user));
       res.status(200).json({
        status:"success",
        user
       })
    }catch(error:any){
      return next(new ErrorHandler(error.message, 400))
    }
  }
)

interface IUpdatePassword{
  newPassword:string,
  oldPassword:string
}

export const updatePassword = CatchAsyncError(
  async(req:any, res:Response, next:NextFunction)=>{
    try{
      const {newPassword, oldPassword} = req.body as IUpdatePassword;
      if(!oldPassword || !newPassword){
        return next(new ErrorHandler("Please enter old and new password",400));
      }
      const user:any = await Account.findById(req.user._id).select("+password");
      if(user.password === undefined){
        return next(new ErrorHandler("Invalid User",400));
      }
      const isPasswordMatch = await  user?.comparePassword(oldPassword);

      if(!isPasswordMatch){
          return next(new ErrorHandler("Invalid old password",400));
      }
      user.password = newPassword;
      
      await user.save();
      await redis.set(req.user?._id, JSON.stringify(user))
      res.status(200).json({
        success:true,
        user,
      })
    }catch(error:any){
        return next(new ErrorHandler(error.message, 400));
    }
  })


 //update profile picture
 export const updateProfilePicture = CatchAsyncError(
  async(req:any, res:Response,next:NextFunction)=>{
    try{
      const {avatar}= req.body;
      const userId = req.user?._id;
      console.log("UserIDDDD",userId);
      const user = await Account.findById(userId);
       console.log("userrrr",user);
    //   if(avatar && user){
    //     // if user have own avatar  then call this if
    //   if(user?.avatar?.public_id){
    //     // first delete the old one
    //    await cloudinary.uploader.destroy(user?.avatar?.public_id);
    //    const myCloud = await cloudinary.uploader.upload(avatar,{
    //     folder:"avatars",
    //     width:150,
    //   });
    //   console.log("myCloud",myCloud);
    //   user.avatar={
    //     public_id:myCloud?.public_id,
    //     url:myCloud?.secure_url
    //   }
    //   }else{
    //     console.log("else")
    //     const myCloud = await cloudinary.uploader.upload(avatar,{
    //       folder:"avatars",
    //       width:150,
    //        crop: "scale"
    //     });
    //     console.log("myCloud",myCloud);
    //     user.avatar={
    //       public_id:myCloud?.public_id,
    //       url:myCloud?.secure_url
    //     }
    //   }
    // }


    if (avatar && user) {
      // If the user has an avatar already
      if (user?.avatar?.public_id) {
          try {
              // First, delete the old one
              await cloudinary.uploader.destroy(user.avatar.public_id);
          } catch (err) {
              console.error("Error deleting old avatar:", err);
              return next(new ErrorHandler("Failed to delete old avatar", 500));
          }
      }

      try {
          // Upload the new avatar
          const myCloud = await cloudinary.uploader.upload(avatar, {
              folder: "avatars",
              width: 150,
              crop: "scale"
          });
          console.log("myCloud", myCloud);

          user.avatar = {
              public_id: myCloud.public_id,
              url: myCloud.secure_url,
          };
      } catch (err) {
          console.error("Error uploading new avatar:", err);
          return next(new ErrorHandler("Failed to upload new avatar", 500));
      }
  }

  
    await user?.save();
    await redis.set(userId,JSON.stringify(user));
    
    res.status(200).json({
      success:true,
      user
    })
    }catch(error:any){
      return next(new ErrorHandler(error.message,400))
    }
  }
 ) 
// async function hashPassword(password: string) {
//   const salt_rounds = process.env.SALT_ROUNDS;
//   if (!salt_rounds) {
//     throw new Error("Salt Rounds is not set in Environment Variables");
//   }
//   const SALT_ROUNDS = parseInt(salt_rounds, 10);
//   if (isNaN(SALT_ROUNDS)) {
//     throw new Error("SALT ROUNDS is not configured");
//   }

//   const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
//   return hashedPassword;
// }

// export async function CreateUserRepo(data: IAccount) {
//   try {
//     const hashedPassword= await hashPassword(data.password);
//     const User = await Account.create(new Account({
//         name:data.name,
//         username:data.username,
//         password:hashedPassword,
//         role:data.role
//     }))
//     const userId= User._id;
//     if(!SECRET_KEY){
//         throw new Error("Secret key is required");
//     }
//     const token = jwt.sign({ userId }, SECRET_KEY);
//     return{
//         status:'success',
//         token:token
//     }
//   } catch (error: any) {
//     throw new Error(error.message);
//   }
// }
