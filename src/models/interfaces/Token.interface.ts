import mongoose, { Document } from "mongoose";
import { TokenType } from "../enums/TokenType.enum";

export interface IToken extends Document{
    user:  mongoose.Types.ObjectId;
    expiresIn: Date;
    hash: string;
    createdAt: Date;
    updatedAt: Date;
    type: TokenType;
}