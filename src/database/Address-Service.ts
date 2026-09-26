import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../errors/Custom-errors.js';

const prisma = new PrismaClient();

export interface Address {
  id: string;
  userId: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  label: 'HOME' | 'WORK' | 'OTHER';
  createdAt: string;
}

// User address store (in-memory persistent service linked by userId)
const userAddresses: Map<string, Address[]> = new Map();

class AddressService {
  constructor(private readonly prisma: PrismaClient) {}

  async createAddress(
    userId: string,
    data: {
      recipientName: string;
      phone: string;
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      isDefault?: boolean;
      label?: 'HOME' | 'WORK' | 'OTHER';
    }
  ): Promise<Address> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!data.recipientName || !data.street || !data.city || !data.postalCode) {
      throw new BadRequestError('Recipient name, street, city, and postal code are required');
    }

    if (!userAddresses.has(userId)) {
      userAddresses.set(userId, []);
    }

    const addresses = userAddresses.get(userId)!;
    const shouldBeDefault = data.isDefault ?? addresses.length === 0;

    if (shouldBeDefault) {
      addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    const newAddress: Address = {
      id: crypto.randomUUID(),
      userId,
      recipientName: data.recipientName.trim(),
      phone: data.phone || '',
      street: data.street.trim(),
      city: data.city.trim(),
      state: data.state || '',
      postalCode: data.postalCode.trim(),
      country: data.country || 'US',
      isDefault: shouldBeDefault,
      label: data.label || 'HOME',
      createdAt: new Date().toISOString(),
    };

    addresses.push(newAddress);
    return newAddress;
  }

  async getUserAddresses(userId: string): Promise<Address[]> {
    return userAddresses.get(userId) || [];
  }

  async getDefaultAddress(userId: string): Promise<Address | null> {
    const addresses = userAddresses.get(userId) || [];
    return addresses.find((a) => a.isDefault) || addresses[0] || null;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    data: Partial<Omit<Address, 'id' | 'userId' | 'createdAt'>>
  ): Promise<Address> {
    const addresses = userAddresses.get(userId) || [];
    const index = addresses.findIndex((a) => a.id === addressId);

    if (index === -1) {
      throw new NotFoundError('Address not found');
    }

    if (data.isDefault) {
      addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    const updated = {
      ...addresses[index],
      ...data,
    };

    addresses[index] = updated;
    return updated;
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const addresses = userAddresses.get(userId) || [];
    const index = addresses.findIndex((a) => a.id === addressId);

    if (index === -1) {
      throw new NotFoundError('Address not found');
    }

    const wasDefault = addresses[index].isDefault;
    addresses.splice(index, 1);

    if (wasDefault && addresses.length > 0) {
      addresses[0].isDefault = true;
    }
  }
}

const addressService = new AddressService(prisma);
export default addressService;
