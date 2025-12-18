import { EventType, MemberAccountCreatedEvent } from '@exodus/common';
import { ObjectId } from '@exodus/object-id';
import { AccountProjectionState } from '../libs/types';
import { ProjectionEventHandler } from '@exodus/arque';

export const MemberAccountCreatedEventHandler: ProjectionEventHandler<
  MemberAccountCreatedEvent,
  AccountProjectionState
> = {
  type: EventType.MemberAccountCreated,
  handle: async ({ state }, event) => {
    // event.aggregate.id is already a Buffer, create ObjectId from it
    const id = new ObjectId(event.aggregate.id);
    console.log('Handling MemberAccountCreated event', { event, id });

    if (!event.body) {
      console.error('❌ MemberAccountCreated event missing body:', event);
      return;
    }

    const { email, username, password } = event.body;
    if (!email || !username || !password) {
      console.error(
        '❌ MemberAccountCreated event missing fields:',
        event.body
      );
      return;
    }

    const emailExist = await state.account.findAll({
      page: 1,
      limit: 1,
      filter: { email },
    });

    const usernameExist = await state.account.findAll({
      page: 1,
      limit: 1,
      filter: { username },
    });

    if (Array.isArray(usernameExist) && usernameExist.length > 0) {
      console.log('⏭️ Account already exists, skipping:', {
        username,
        id: id.toString(),
      });
      return;
    }
    if (Array.isArray(emailExist) && emailExist.length > 0) {
      console.log('⏭️ Account already exists, skipping:', {
        email,
        id: id.toString(),
      });
      return;
    }

    await state.account.create({
      id,
      username,
      email,
      password,
    });

    console.log('✅ Member account created in projection:', {
      id: id.toString(),
      email,
      username,
    });
  },
};
