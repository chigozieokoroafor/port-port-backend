import type { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { getQuoteListDAO, getQuotesList, ListQuotesDTO, TListQuotesDTO, validateDTO } from './util';

/**
 * @desc    Get all quote requests (admin view)
 * @route   GET /api/admin/quotes
 * @access  Private (Admin)
 */
export const getQuotesController = catchAsync(async (req: Request, res: Response) => {

    const dto = await validateDTO<TListQuotesDTO>(req.query, ListQuotesDTO)

    const data = await getQuotesList(dto)

    res.status(200).json({
        success: true,
        data: getQuoteListDAO(data)
    });

});
