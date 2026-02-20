import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import User from '../models/User.model';
import { UserStatus } from '../models/enums/UserStatus.enum';
import { sendInviteMail } from '../services/email.service';

/**
 * @desc    Invite new admin
 * @route   POST /api/admin/invite
 * @access  SuperAdmin only
 */
export const inviteAdmin = catchAsync(async (req: Request, res: Response) => {
    const { email, firstName, lastName, role } = req.body;

    if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
    }



    // Create new admin user
    const user = await User.create({
        email,
        firstName,
        lastName,
        role: role,
        status: UserStatus.Pending,
        invitedBy: req.user._id,
        password: crypto.randomBytes(32).toString('hex')
    });

    // Send invite email
    await sendInviteMail(user);

    res.status(201).json({
        success: true,
        message: 'Admin invite sent successfully',
        data: {
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                invitedBy: req.user.getFullName(),
                createdAt: user.createdAt,
            },
        },
    });
});

/**
 * @desc    Get all admin users
 * @route   GET /api/admin/users
 * @access  SuperAdmin only
 */
export const getAllAdmins = catchAsync(async (req: Request, res: Response) => {
    const { status, role, search, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter: any = {};

    if (status) {
        filter.status = status;
    }

    if (role) {
        filter.role = role;
    }

    if (search) {
        filter.$or = [
            { email: { $regex: search, $options: 'i' } },
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
        ];
    }

    // Pagination
    const pageNum = Number.parseInt(page as string, 10);
    const limitNum = Number.parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await User.countDocuments(filter);

    // Get admins with pagination
    const admins = await User.find(filter)
        .populate('invitedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    res.status(200).json({
        success: true,
        data: {
            admins: admins.map((admin) => ({
                id: admin._id,
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName,
                fullName: admin.getFullName(),
                role: admin.role,
                status: admin.status,
                lastLogin: admin.lastLogin,
                invitedBy: admin.invitedBy,
                createdAt: admin.createdAt,
                updatedAt: admin.updatedAt,
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        },
    });
});

/**
 * @desc    Update admin user
 * @route   PUT /api/admin/users/:id
 * @access  SuperAdmin only
 */
export const updateAdmin = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { firstName, lastName, role, status } = req.body;

    if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
    }

    // Find admin user
    const admin = await User.findById(id);

    if (!admin) {
        throw new ApiError(404, 'Admin user not found');
    }

    // Prevent superadmin from demoting themselves
    if (admin._id.toString() === req.user._id.toString() && role === 'admin') {
        throw new ApiError(400, 'You cannot demote yourself from SuperAdmin');
    }

    // Prevent superadmin from suspending themselves
    if (admin._id.toString() === req.user._id.toString() && status === 'suspended') {
        throw new ApiError(400, 'You cannot suspend yourself');
    }

    // Update fields
    if (firstName !== undefined) admin.firstName = firstName;
    if (lastName !== undefined) admin.lastName = lastName;
    if (role !== undefined) admin.role = role;
    if (status !== undefined) admin.status = status;

    await admin.save();

    res.status(200).json({
        success: true,
        message: 'Admin user updated successfully',
        data: {
            user: {
                id: admin._id,
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName,
                fullName: admin.getFullName(),
                role: admin.role,
                status: admin.status,
                lastLogin: admin.lastLogin,
                createdAt: admin.createdAt,
                updatedAt: admin.updatedAt,
            },
        },
    });
});

/**
 * @desc    Delete admin user
 * @route   DELETE /api/admin/users/:id
 * @access  SuperAdmin only
 */
export const deleteAdmin = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
    }

    // Find admin user
    const admin = await User.findById(id);

    if (!admin) {
        throw new ApiError(404, 'Admin user not found');
    }

    // Prevent superadmin from deleting themselves
    if (admin._id.toString() === req.user._id.toString()) {
        throw new ApiError(400, 'You cannot delete yourself');
    }

    // Delete admin user
    await User.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: 'Admin user deleted successfully',
        data: {
            deletedUser: {
                id: admin._id,
                email: admin.email,
                fullName: admin.getFullName(),
            },
        },
    });
});

/**
 * @desc    Get single admin user details
 * @route   GET /api/admin/users/:id
 * @access  SuperAdmin only
 */
export const getAdminById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const admin = await User.findById(id).populate(
        'invitedBy',
        'firstName lastName email'
    );

    if (!admin) {
        throw new ApiError(404, 'Admin user not found');
    }

    res.status(200).json({
        success: true,
        data: {
            user: {
                id: admin._id,
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName,
                fullName: admin.getFullName(),
                role: admin.role,
                status: admin.status,
                lastLogin: admin.lastLogin,
                invitedBy: admin.invitedBy,
                createdAt: admin.createdAt,
                updatedAt: admin.updatedAt,
            },
        },
    });
});

/**
 * @desc    Resend invite to pending admin
 * @route   POST /api/admin/users/:id/resend-invite
 * @access  SuperAdmin only
 */
export const resendInvite = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
    }

    const admin = await User.findById(id);

    if (!admin) {
        throw new ApiError(404, 'Admin user not found');
    }

    if (admin.status !== UserStatus.Pending) {
        throw new ApiError(400, 'Admin account is already active');
    }

    const link = await sendInviteMail(admin);

    res.status(200).json({
        success: true,
        data:{
            link
        },
        message: 'Invite resent successfully',
    });
});