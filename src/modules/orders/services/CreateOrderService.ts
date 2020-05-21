import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface IProductForOrder {
  product_id: string;
  price: number;
  quantity: number;
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User not found');
    }

    const numberOfProductsInOrder = products.length;
    const currentProductsQuantity = await this.productsRepository.findAllById(
      products,
    );
    const numberOfProductsFoundInDatabase = currentProductsQuantity.length;
    if (numberOfProductsInOrder !== numberOfProductsFoundInDatabase) {
      throw new AppError('Some products ordered do not exist in stock');
    }

    let updateProductsQuantity: IProduct[] = [];
    updateProductsQuantity = currentProductsQuantity.map((product, index) => {
      const { id, quantity } = product;
      const newQuantity = quantity - products[index].quantity;
      if (newQuantity < 0) {
        throw new AppError(`Insufficient quantity for product ${product.name}`);
      }
      return {
        id,
        quantity: newQuantity,
      };
    });

    const updatedProducts = await this.productsRepository.updateQuantity(
      updateProductsQuantity,
    );

    let productListForOrder: IProductForOrder[] = [];
    productListForOrder = updatedProducts.map((product, index) => {
      const { id, price } = product;
      const { quantity } = products[index];
      return {
        product_id: id,
        price,
        quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productListForOrder,
    });

    return order;
  }
}

export default CreateProductService;
