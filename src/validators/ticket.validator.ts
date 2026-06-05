import { body, param } from 'express-validator';

export const validateAddConversation = [
    body('ticketId')
    .trim()
    .notEmpty()
    .withMessage('Ticket Id is required'),
    
    body('conversation.user')
    .trim()
    .notEmpty()
    .withMessage('User id of sender is required'),

    body('conversation.text')
    .trim()
    .notEmpty()
    .withMessage('Message text is required')
]

export const validateTicketById = [
    param('id')
    .trim()
    .notEmpty()
    .withMessage('Ticket Id is required')
]