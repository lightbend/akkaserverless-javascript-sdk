/*
 * Copyright 2019 Lightbend Inc.
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

const Action = require("@lightbend/akkaserverless-javascript-sdk").Action;
const EventSourced = require("@lightbend/akkaserverless-javascript-sdk").EventSourced;

const eventSourcedEntityOne = new EventSourced(
  ["proto/eventlogeventing.proto"],
  "akkaserverless.tck.model.eventlogeventing.EventSourcedEntityOne",
  {
    entityType: "eventlogeventing-one"
  }
);

const Empty = eventSourcedEntityOne.lookupType("google.protobuf.Empty").create();

eventSourcedEntityOne.initial = entityId => Empty;

eventSourcedEntityOne.behavior = state => {
  return {
    commandHandlers: {
      EmitEvent: emitEvent
    },
    eventHandlers: {
      EventOne: () => Empty,
      EventTwo: () => Empty
    }
  };
};

function emitEvent(request, state, context) {
  context.emit(request.eventOne ? request.eventOne : requestEventTwo);
  return Empty;
}

const eventSourcedEntityTwo = new EventSourced(
  ["proto/eventlogeventing.proto"],
  "akkaserverless.tck.model.eventlogeventing.EventSourcedEntityTwo",
  {
    entityType: "eventlogeventing-two",
    serializeFallbackToJson: true
  }
);

eventSourcedEntityTwo.initial = entityId => Empty;

eventSourcedEntityTwo.behavior = state => {
  return {
    commandHandlers: {
      EmitJsonEvent: emitJsonEvent
    },
    eventHandlers: {
      JsonMessage: () => Empty
    }
  };
};

function emitJsonEvent(event, state, context) {
  context.emit({
    type: "JsonMessage",
    message: event.message
  });
  return Empty;
}

const eventLogSubscriber = new Action(
  "proto/eventlogeventing.proto",
  "akkaserverless.tck.model.eventlogeventing.EventLogSubscriberModel"
);

const Response = eventLogSubscriber.lookupType("akkaserverless.tck.model.eventlogeventing.Response");

eventLogSubscriber.commandHandlers = {
  ProcessEventOne: processEventOne,
  ProcessEventTwo: processEventTwo,
  Effect: effect,
  ProcessAnyEvent: processAnyEvent
};

function processEventOne(event, context) {
  process(event.step, context);
}

function processEventTwo(event, context) {
  event.step.forEach(step => process(step, context));
}

function effect(request, context) {
  return Response.create({ id: request.id, message: request.message });
}

function processAnyEvent(event, context) {
  return Response.create({ id: context.cloudevent.subject, message: event.message });
}

function process(step, context) {
  const id = context.cloudevent.subject;
  if (step.reply)
    context.write(Response.create({ id: id, message: step.reply.message }));
  else if (step.forward)
    context.thenForward(eventLogSubscriber.service.methods.Effect, { id: id, message: step.forward.message });
}

module.exports.eventSourcedEntityOne = eventSourcedEntityOne;
module.exports.eventSourcedEntityTwo = eventSourcedEntityTwo;
module.exports.eventLogSubscriber = eventLogSubscriber;