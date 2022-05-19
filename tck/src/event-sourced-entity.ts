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

import { EventSourcedEntity } from '@kalix-io/kalix-javascript-sdk';
import { Reply, replies } from '@kalix-io/kalix-javascript-sdk';
import protocol from '../generated/tck';

type Request = protocol.kalix.tck.model.eventsourcedentity.Request;
type Response = protocol.kalix.tck.model.eventsourcedentity.Response;

const { Request, Response } = protocol.kalix.tck.model.eventsourcedentity;

export const tckModel = new EventSourcedEntity<Persisted, Persisted>(
  ['proto/event_sourced_entity.proto'],
  'kalix.tck.model.eventsourcedentity.EventSourcedTckModel',
  'event-sourced-tck-model',
  {
    snapshotEvery: 5,
  },
);

// We need to use the reflective types for state
type IPersisted = protocol.kalix.tck.model.eventsourcedentity.IPersisted;
type Persisted = protobuf.Message & IPersisted;
const Persisted = tckModel.lookupType(
  'kalix.tck.model.eventsourcedentity.Persisted',
);

tckModel.initial = () => Persisted.create();

tckModel.behavior = () => ({
  commandHandlers: {
    Process: process,
  },
  eventHandlers: {
    Persisted: persisted,
  },
});

function process(
  request: Request,
  state: Persisted,
  context: EventSourcedEntity.CommandContext<Persisted>,
): Reply<Response> {
  let reply: Reply<Response> | undefined,
    effects: replies.Effect[] = [];
  request.actions.forEach((action) => {
    if (action.emit) {
      const event = Persisted.create({ value: action.emit.value });
      context.emit(event);
      // events are not emitted immediately, so we also update the function local state directly for responses
      state = persisted(event, state);
    } else if (action.forward) {
      reply = Reply.forward(two.service.methods.Call, {
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
      reply = Reply.failure(action.fail.message || '');
    }
  });
  // if we don't already have a reply from the actions
  if (!reply)
    reply = Reply.message(
      Response.create(state.value ? { message: state.value } : {}),
    );
  reply.addEffects(effects);
  return reply;
}

function persisted(event: Persisted, state: Persisted) {
  if (event.value) state.value += event.value;
  return state;
}

export const two = new EventSourcedEntity<Persisted>(
  ['proto/event_sourced_entity.proto'],
  'kalix.tck.model.eventsourcedentity.EventSourcedTwo',
  'event-sourced-tck-model-2',
)
  .setInitial(() => Persisted.create())
  .setBehavior(() => ({
    commandHandlers: {
      Call: () => replies.message(Response.create()),
    },
    eventHandlers: {},
  }));

export const configured = new EventSourcedEntity<Persisted>(
  ['proto/event_sourced_entity.proto'],
  'kalix.tck.model.eventsourcedentity.EventSourcedConfigured',
  'event-sourced-configured',
)
  .setInitial(() => Persisted.create())
  .setBehavior(() => ({
    commandHandlers: {
      Call: () => replies.message(Response.create()),
    },
    eventHandlers: {},
  }));
