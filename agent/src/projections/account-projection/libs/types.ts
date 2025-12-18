import { Connection } from 'mongoose';
import { AccountService } from '../../../features//account-model/account.service';

export type AccountProjectionState = {
  connection: Connection;
  account: AccountService;
};
