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

import * as util from 'util';
import AnySupport from '../protobuf-any';
import * as proto from '../../proto/protobuf-bundle';

import { ReplicatedCounter } from './counter';
import { ReplicatedSet } from './set';
import { ReplicatedRegister } from './register';
import { ReplicatedMap } from './map';
import { ReplicatedCounterMap } from './counter-map';
import { ReplicatedRegisterMap } from './register-map';
import { ReplicatedMultiMap } from './multi-map';
import { Vote } from './vote';

/** @internal */
namespace protocol {
  export const Empty = proto.google.protobuf.Empty;

  export type Delta =
    proto.kalix.component.replicatedentity.IReplicatedEntityDelta;

  export type Clock =
    proto.kalix.component.replicatedentity.ReplicatedEntityClock;

  export const Clock =
    proto.kalix.component.replicatedentity.ReplicatedEntityClock;
}

/**
 * A Replicated Data type.
 *
 * @public
 */
export interface ReplicatedData {
  /** @internal */
  getAndResetDelta(initial?: boolean): protocol.Delta | null;

  /** @internal */
  applyDelta(
    delta: protocol.Delta,
    anySupport: AnySupport,
    createForDelta: (delta: protocol.Delta) => ReplicatedData,
  ): void;
}

export {
  ReplicatedCounter,
  ReplicatedSet,
  ReplicatedRegister,
  ReplicatedMap,
  ReplicatedCounterMap,
  ReplicatedRegisterMap,
  ReplicatedMultiMap,
  Vote,
};

/**
 * A clock that may be used by {@link ReplicatedRegister}.
 *
 * @public
 */
export type Clock = number;

/**
 * An enum of all clocks that can be used by {@link ReplicatedRegister}.
 *
 * @public
 */
export enum Clocks {
  /**
   * The default clock, uses the machines system time.
   */
  DEFAULT = protocol.Clock.REPLICATED_ENTITY_CLOCK_DEFAULT_UNSPECIFIED,

  /**
   * A reverse clock, for achieving first - write - wins semantics.
   */
  REVERSE = protocol.Clock.REPLICATED_ENTITY_CLOCK_REVERSE,

  /**
   * A custom clock.
   */
  CUSTOM = protocol.Clock.REPLICATED_ENTITY_CLOCK_CUSTOM,

  /**
   * A custom clock that automatically increments if the current clock value is less than the existing clock value.
   */
  CUSTOM_AUTO_INCREMENT = protocol.Clock
    .REPLICATED_ENTITY_CLOCK_CUSTOM_AUTO_INCREMENT,
}

/** @internal */
export function createForDelta(delta: protocol.Delta): ReplicatedData {
  if (delta.counter) {
    return new ReplicatedCounter();
  } else if (delta.replicatedSet) {
    return new ReplicatedSet();
  } else if (delta.register) {
    // It needs to be initialised with a value
    return new ReplicatedRegister(protocol.Empty.create({}));
  } else if (delta.replicatedMap) {
    return new ReplicatedMap();
  } else if (delta.replicatedCounterMap) {
    return new ReplicatedCounterMap();
  } else if (delta.replicatedRegisterMap) {
    return new ReplicatedRegisterMap();
  } else if (delta.replicatedMultiMap) {
    return new ReplicatedMultiMap();
  } else if (delta.vote) {
    return new Vote();
  } else {
    throw new Error(util.format('Unknown Replicated Data type: %o', delta));
  }
}
