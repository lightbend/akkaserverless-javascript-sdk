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


const ReplicatedEntity = require("@lightbend/akkaserverless-javascript-sdk").ReplicatedEntity;
const ReplicatedData = require("@lightbend/akkaserverless-javascript-sdk").ReplicatedData;

const entity = new ReplicatedEntity(
  "replicated_entity_example.proto",
  "com.example.replicatedentity.ReplicatedEntityExample",
  "replicated-entity-example"
);

entity.commandHandlers = {
  UpdateReplicatedCounter: updateReplicatedCounter,
  GetReplicatedCounter: getReplicatedCounter,
  MutateReplicatedSet: mutateReplicatedSet,
  GetReplicatedSet: getReplicatedSet,
  Connect: connect,
  Monitor: monitor
};

function updateReplicatedCounter(update, ctx) {
  if (ctx.state === null) {
    ctx.state = new ReplicatedData.ReplicatedCounter();
  }

  if (update.value !== 0) {
    ctx.state.increment(update.value);
  }
  return {
    value: ctx.state.value
  };
}

function getReplicatedCounter(get, ctx) {
  if (ctx.state === null) {
    ctx.state = new ReplicatedData.ReplicatedCounter();
  }

  return {
    value: ctx.state.value
  };
}

function mutateReplicatedSet(update, ctx) {
  if (ctx.state === null) {
    ctx.state = new ReplicatedData.ReplicatedSet();
  }

  if (update.clear) {
    ctx.state.clear();
  }
  update.remove.forEach(value => {
    ctx.state.delete(value);
  });
  update.add.forEach(value => {
    ctx.state.add(value);
  });

  return {
    size: ctx.state.size
  }
}

function getReplicatedSet(get, ctx) {
  if (ctx.state === null) {
    ctx.state = new ReplicatedData.ReplicatedSet();
  }

  return {
    items: Array.from(ctx.state)
  };
}

/**
 * User presence feature.
 *
 * This is a streamed call. As long as a user (id given by the entity id) is connected
 * to it, they are considered to be online.
 *
 * Here we use a Vote Replicated Data object, which if at least one node votes is true,
 * will be true. So when the user connects, we invoke the connect() method (which we have
 * defined by enriching the Replicated Entity in onStateSet), which will manage our vote
 * accordingly.
 *
 * When they disconnect, the onStreamCancel callback is invoked, and we disconnect,
 * removing our vote if this is the last connection to this Replicated Entity.
 */
function connect(user, ctx) {
  if (ctx.state === null) {
    ctx.state = new ReplicatedData.Vote();
  }
  if (ctx.streamed) {
    ctx.onStreamCancel = state => {
      state.disconnect();
    };
    ctx.state.connect();
  }
}

/**
 * User presence monitoring call.
 *
 * This is a streamed call. We add a onStateChange callback, so that whenever the
 * Replicated Entity's state changes, if the online status has changed, we return it.
 */
function monitor(user, ctx) {
  if (ctx.state === null) {
    ctx.state = new ReplicatedData.Vote();
  }
  let online = ctx.state.atLeastOne;
  if (ctx.streamed) {
    ctx.onStateChange = state => {
      if (online !== state.atLeastOne) {
        online = state.atLeastOne;
        return {online};
      }
    };
  }
  return {online};
}

/**
 * This is invoked whenever a new state is created, either by setting
 * ctx.state = myReplicatedData, or when the server pushes a new state. This is provided
 * to allow us to configure the Replicated Entity, or enrich it with additional non-replicated
 * state, in this case, for the vote Replicated Data type, we add the number of users connected
 * to this node to it, so that only remove our vote when that number goes down to zero.
 */
entity.onStateSet = state => {
  if (state instanceof ReplicatedData.Vote) {
    state.users = 0;
    // Enrich the state with callbacks for users connected
    state.connect = () => {
      state.users += 1;
      if (state.users === 1) {
        state.vote = true;
      }
    };
    state.disconnect = () => {
      state.users -= 1;
      if (state.users === 0) {
        state.vote = false;
      }
    };
  }
};

// Export the entity
module.exports = entity;
