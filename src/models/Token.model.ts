import mongoose, { Schema } from "mongoose";
import { IToken } from "./interfaces/Token.interface";
import { TokenType } from "./enums/TokenType.enum";

const tokenSchema = new Schema<IToken>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    expiresIn: Date,
    type: {
        type: String,
        enum:{
            values:[TokenType.EmailVerification, TokenType.InviteUser, TokenType.ResetPassword ],
            message: '{VALUE} is not a valid token type',
        }
    },
    hash: String
}, {
    timestamps: true
})

const Token = mongoose.model<IToken>(
  'Token',
  tokenSchema, 'Token'
);

export default Token;