import { Account } from '../features/account-model/repositories/account.repository';

export type AppRequest<T> = T & {
  account?: Account;
};
