// we use oops here make object orient class
 
// extends Error is building js Error class
class ErrorHandler extends Error{      
    statusCode:Number;

    constructor(message:any, statusCode:Number){
        super(message);
        this.statusCode = statusCode;

        Error.captureStackTrace(this, this.constructor);   // captureStackTrace tells in which location we got that error
    }
}

export default ErrorHandler;