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

import { ReplicatedData } from '.';
import ReplicatedSet from './set';
import AnySupport, { Comparable } from '../protobuf-any';
import { Serializable } from '../serializable';
import iterators from './iterators';
import util from 'util';
import * as proto from '../../proto/protobuf-bundle';

const debug = require('debug')('kalix-replicated-entity');

namespace protocol {
  export type Delta =
    proto.kalix.component.replicatedentity.IReplicatedEntityDelta;

  export type EntryDelta =
    proto.kalix.component.replicatedentity.IReplicatedMultiMapEntryDelta;
}

interface Entry {
  key: Serializable;
  values: ReplicatedSet;
}

class ReplicatedMultiMap implements ReplicatedData {
  private entries = new Map<Comparable, Entry>();
  private removed = new Map<Comparable, Serializable>();
  private cleared = false;

  private EmptySet = Object.freeze(new Set<Serializable>());

  get = (key: Serializable): Set<Serializable> => {
    const entry = this.entries.get(AnySupport.toComparable(key));
    return entry !== undefined ? entry.values.elements() : this.EmptySet;
  };

  put = (key: Serializable, value: Serializable): ReplicatedMultiMap => {
    this.getOrCreateValues(key).add(value);
    return this;
  };

  putAll = (
    key: Serializable,
    values: Iterable<Serializable>,
  ): ReplicatedMultiMap => {
    this.getOrCreateValues(key).addAll(values);
    return this;
  };

  delete = (key: Serializable, value: Serializable): ReplicatedMultiMap => {
    const comparableKey = AnySupport.toComparable(key);
    const entry = this.entries.get(comparableKey);
    if (entry) {
      entry.values.delete(value);
      if (entry.values.size === 0) this.deleteAll(key);
    }
    return this;
  };

  deleteAll = (key: Serializable): ReplicatedMultiMap => {
    const comparableKey = AnySupport.toComparable(key);
    if (this.entries.has(comparableKey)) {
      this.entries.delete(comparableKey);
      this.removed.set(comparableKey, key);
    }
    return this;
  };

  has = (key: Serializable): boolean => {
    return this.entries.has(AnySupport.toComparable(key));
  };

  hasValue = (key: Serializable, value: Serializable): boolean => {
    const comparableKey = AnySupport.toComparable(key);
    const entry = this.entries.get(comparableKey);
    return entry ? entry.values.has(value) : false;
  };

  get size(): number {
    return Array.from(this.entries.values()).reduce(
      (sum, entry) => sum + entry.values.size,
      0,
    );
  }

  get keysSize(): number {
    return this.entries.size;
  }

  keys = (): IterableIterator<Serializable> => {
    return iterators.map(this.entries.values(), (entry) => entry.key);
  };

  clear = (): ReplicatedMultiMap => {
    if (this.entries.size > 0) {
      this.cleared = true;
      this.entries.clear();
      this.removed.clear();
    }
    return this;
  };

  private getOrCreateValues(key: Serializable): ReplicatedSet {
    const comparableKey = AnySupport.toComparable(key);
    const entry = this.entries.get(comparableKey);
    if (entry) {
      return entry.values;
    } else {
      const values = new ReplicatedSet();
      this.entries.set(comparableKey, { key: key, values: values });
      return values;
    }
  }

  getAndResetDelta = (initial?: boolean): protocol.Delta | null => {
    const updated: protocol.EntryDelta[] = [];
    this.entries.forEach(({ key: key, values: values }, _comparableKey) => {
      const delta = values.getAndResetDelta();
      if (delta !== null) {
        updated.push({
          key: AnySupport.serialize(key, true, true),
          delta: delta.replicatedSet,
        });
      }
    });
    if (
      this.cleared ||
      this.removed.size > 0 ||
      updated.length > 0 ||
      initial
    ) {
      const delta = {
        replicatedMultiMap: {
          cleared: this.cleared,
          removed: Array.from(this.removed.values()).map((key) =>
            AnySupport.serialize(key, true, true),
          ),
          updated: updated,
        },
      };
      this.cleared = false;
      this.removed.clear();
      return delta;
    } else {
      return null;
    }
  };

  applyDelta = (delta: protocol.Delta, anySupport: AnySupport): void => {
    if (!delta.replicatedMultiMap) {
      throw new Error(
        util.format('Cannot apply delta %o to ReplicatedMultiMap', delta),
      );
    }
    if (delta.replicatedMultiMap.cleared) {
      this.entries.clear();
    }
    if (delta.replicatedMultiMap.removed) {
      delta.replicatedMultiMap.removed.forEach((serializedKey) => {
        const key = anySupport.deserialize(serializedKey);
        const comparableKey = AnySupport.toComparable(key);
        if (this.entries.has(comparableKey)) {
          this.entries.delete(comparableKey);
        } else {
          debug('Key to delete [%o] is not in ReplicatedMultiMap', key);
        }
      });
    }
    if (delta.replicatedMultiMap.updated) {
      delta.replicatedMultiMap.updated.forEach((entry) => {
        const key = anySupport.deserialize(entry.key);
        this.getOrCreateValues(key).applyDelta(
          { replicatedSet: entry.delta },
          anySupport,
        );
      });
    }
  };

  toString = (): string => {
    return (
      'ReplicatedMultiMap(' +
      Array.from(this.entries.values())
        .map(
          (entry) =>
            entry.key + ' -> (' + Array.from(entry.values).join(', ') + ')',
        )
        .join(', ') +
      ')'
    );
  };
}

export = ReplicatedMultiMap;
