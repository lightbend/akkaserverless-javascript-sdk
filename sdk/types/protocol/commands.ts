/*
 * Copyright 2021-2023 Lightbend Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// re-export types generated by proto-loader-gen-types to be namespaced together
// use `__Output` types for incoming messages, which will have defaults applied

export { Command__Output as EntityCommand } from '../generated/proto/kalix/component/entity/Command';
export { Metadata__Output as Metadata } from '../generated/proto/kalix/component/Metadata';

import { ValueEntityStreamOut } from '../generated/proto/kalix/component/valueentity/ValueEntityStreamOut';
import { EventSourcedStreamOut } from '../generated/proto/kalix/component/eventsourcedentity/EventSourcedStreamOut';
import { ReplicatedEntityStreamOut } from '../generated/proto/kalix/component/replicatedentity/ReplicatedEntityStreamOut';

export type EntityStreamOut =
  | ValueEntityStreamOut
  | EventSourcedStreamOut
  | ReplicatedEntityStreamOut;

import { ValueEntityReply } from '../generated/proto/kalix/component/valueentity/ValueEntityReply';
import { EventSourcedReply } from '../generated/proto/kalix/component/eventsourcedentity/EventSourcedReply';
import { ReplicatedEntityReply } from '../generated/proto/kalix/component/replicatedentity/ReplicatedEntityReply';

export type EntityReply =
  | ValueEntityReply
  | EventSourcedReply
  | ReplicatedEntityReply;

export { Forward } from '../generated/proto/kalix/component/Forward';
export { SideEffect } from '../generated/proto/kalix/component/SideEffect';
export { Failure } from '../generated/proto/kalix/component/Failure';
