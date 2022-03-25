/*
 * Copyright 2021 Lightbend Inc.
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

import { ValueEntity } from '@lightbend/kalix-javascript-sdk';
import { replies } from '@lightbend/kalix-javascript-sdk';
import protocol from '../generated/tck';

type Request = protocol.akkaserverless.tck.model.valueentity.Request;

const { Request, Response } = protocol.akkaserverless.tck.model.valueentity;

export const tckModel = new ValueEntity(
  ['proto/value_entity.proto'],
  'akkaserverless.tck.model.valueentity.ValueEntityTckModel',
  'value-entity-tck-model',
);

// We need to use the reflective types for state
type IPersisted = protocol.akkaserverless.tck.model.valueentity.IPersisted;
type Persisted = protobuf.Message & IPersisted;
const Persisted = tckModel.lookupType(
  'akkaserverless.tck.model.valueentity.Persisted',
);

tckModel
  .setInitial(() => Persisted.create())
  .setCommandHandlers({
    Process: process,
  });

function process(
  request: Request,
  state: Persisted,
  context: ValueEntity.ValueEntityCommandContext,
): replies.Reply {
  let reply: replies.Reply | undefined,
    effects: replies.Effect[] = [];
  request.actions.forEach((action) => {
    if (action.update) {
      state.value = action.update.value;
      context.updateState(state);
    } else if (action.delete) {
      state.value = undefined;
      context.deleteState();
    } else if (action.forward) {
      reply = replies.forward(two.service.methods.Call, {
        id: action.forward.id,
      });
    } else if (action.effect) {
      effects.push(
        new replies.Effect(
          two.service.methods.Call,
          { id: action.effect.id },
          action.effect.synchronous || false,
        ),
      );
    } else if (action.fail) {
      reply = replies.failure(action.fail.message || '');
    }
  });
  if (!reply)
    reply = replies.message(
      Response.create(state.value ? { message: state.value } : {}),
    );
  reply.addEffects(effects);
  return reply;
}

export const two = new ValueEntity(
  ['proto/value_entity.proto'],
  'akkaserverless.tck.model.valueentity.ValueEntityTwo',
  'value-entity-tck-model-two',
)
  .setInitial(() => Persisted.create())
  .setCommandHandlers({
    Call: () => Response.create(),
  });

export const configured = new ValueEntity(
  ['proto/value_entity.proto'],
  'akkaserverless.tck.model.valueentity.ValueEntityConfigured',
  'value-entity-configured',
  {
    entityPassivationStrategy: {
      timeout: 100, // milliseconds
    },
  },
)
  .setInitial(() => Persisted.create())
  .setCommandHandlers({
    Call: () => Response.create(),
  });
