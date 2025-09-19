import express from 'express';
import { CreateUserService } from '../service/account.service';
import { ActivateUser, getUserInfo, loginUser,logoutUser, socialAuth, updateAccessToken, updatePassword, updateProfilePicture, updateUserInfo } from '../repository/account.repository';
import { authorizeRoles, isAuthenticated } from '../middlewares/auth.middleware';

const Account = express.Router();

Account.post('/registration',CreateUserService);
Account.post('/activateAccount',ActivateUser);
Account.post('/login',loginUser);
Account.get('/logout',isAuthenticated,authorizeRoles("admin"),logoutUser);
Account.get('/refresh', updateAccessToken);
Account.get("/me", isAuthenticated, getUserInfo);
Account.post("/social-auth",socialAuth);
Account.put("/update-user-info",isAuthenticated, updateUserInfo)
Account.put("/update-user-password",isAuthenticated, updatePassword);
Account.put("/update-user-avatar",isAuthenticated, updateProfilePicture);



export default Account;