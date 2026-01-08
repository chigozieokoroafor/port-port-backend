import { Request, Response } from 'express';
import crypto from 'crypto';
import AdminUser from '../models/AdminUser.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { sendInviteEmail } from '../services/email.service';

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
    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create new admin user
    const newAdmin = await AdminUser.create({
        email,
        firstName,
        lastName,
        role: role || 'admin',
        status: 'pending',
        invitedBy: req.user._id,
        inviteToken,
        inviteTokenExpiry,
        password: crypto.randomBytes(32).toString('hex'), // Temporary password (will be set during activation)
    });

    // Send invite email
    const inviteUrl = `${process.env.FRONTEND_URL}/activate?token=${inviteToken}`;
    
    try {
        await sendInviteEmail({
            to: email,
            firstName,
            inviteUrl,
            inviterName: req.user.getFullName(),
        });
    } catch (emailError) {
        // If email fails, delete the created user
        await AdminUser.findByIdAndDelete(newAdmin._id);
        throw new ApiError(500, 'Failed to send invite email. Please try again.');
    }

    res.status(201).json({
        success: true,
        message: 'Admin invite sent successfully',
        data: {
        user: {
            id: newAdmin._id,
            email: newAdmin.email,
            firstName: newAdmin.firstName,
            lastName: newAdmin.lastName,
            role: newAdmin.role,
            status: newAdmin.status,
            invitedBy: req.user.getFullName(),
            createdAt: newAdmin.createdAt,
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
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await AdminUser.countDocuments(filter);

    // Get admins with pagination
    const admins = await AdminUser.find(filter)
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
    const admin = await AdminUser.findById(id);

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
    const admin = await AdminUser.findById(id);

    if (!admin) {
        throw new ApiError(404, 'Admin user not found');
    }

    // Prevent superadmin from deleting themselves
    if (admin._id.toString() === req.user._id.toString()) {
        throw new ApiError(400, 'You cannot delete yourself');
    }

    // Delete admin user
    await AdminUser.findByIdAndDelete(id);

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

    const admin = await AdminUser.findById(id).populate(
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

    const admin = await AdminUser.findById(id).select('+inviteToken +inviteTokenExpiry');

    if (!admin) {
        throw new ApiError(404, 'Admin user not found');
    }

    if (admin.status !== 'pending') {
        throw new ApiError(400, 'Admin account is already active');
    }

    // Generate new invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    admin.inviteToken = inviteToken;
    admin.inviteTokenExpiry = inviteTokenExpiry;
    await admin.save();

    // Send invite email
    const inviteUrl = `${process.env.FRONTEND_URL}/activate?token=${inviteToken}`;
    
    await sendInviteEmail({
        to: admin.email,
        firstName: admin.firstName,
        inviteUrl,
        inviterName: req.user.getFullName(),
    });

    res.status(200).json({
        success: true,
        message: 'Invite resent successfully',
    });
});