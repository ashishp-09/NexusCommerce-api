import { Request, Response } from 'express';
import addressService from '../database/Address-Service.js';
import { ApiResponse } from '../utils/api-response.js';
import { User } from '../schemas/index.js';

export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const address = await addressService.createAddress(user.id, req.body);
    ApiResponse.created({
      res,
      message: 'Address created successfully',
      data: address,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to create address',
      error,
    });
  }
};

export const getAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const addresses = await addressService.getUserAddresses(user.id);
    ApiResponse.success({
      res,
      message: 'Addresses retrieved successfully',
      data: addresses,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to retrieve addresses',
      error,
    });
  }
};

export const getDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const defaultAddress = await addressService.getDefaultAddress(user.id);
    ApiResponse.success({
      res,
      message: 'Default address retrieved',
      data: defaultAddress,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to retrieve default address',
      error,
    });
  }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const updated = await addressService.updateAddress(user.id, id, req.body);

    ApiResponse.success({
      res,
      message: 'Address updated successfully',
      data: updated,
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to update address',
      error,
    });
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as User;
    if (!user) {
      ApiResponse.error({ res, statusCode: 401, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    await addressService.deleteAddress(user.id, id);

    ApiResponse.success({
      res,
      message: 'Address deleted successfully',
      data: { id },
    });
  } catch (error) {
    ApiResponse.error({
      res,
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to delete address',
      error,
    });
  }
};
