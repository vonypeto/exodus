export enum AggregateType {
  Account = 1,
}

export enum EventType {
  MemberAccountCreated = (AggregateType.Account << 8) | 1,
  MemberAccountUpdated = (AggregateType.Account << 8) | 2,
  MemberAccountDeleted = (AggregateType.Account << 8) | 3,
}
