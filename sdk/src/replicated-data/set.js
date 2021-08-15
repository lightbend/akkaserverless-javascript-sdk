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

const debug = require('debug')('akkaserverless-replicated-entity');
const util = require('util');
const AnySupport = require('../protobuf-any');

/**
 * @classdesc A Replicated Set data type.
 *
 * A ReplicatedSet is a set of {@link module:akkaserverless.Serializable} values. Elements can be added and removed.
 *
 * @constructor module:akkaserverless.replicatedentity.ReplicatedSet
 * @implements module:akkaserverless.replicatedentity.ReplicatedData
 * @implements Iterable<module:akkaserverless.Serializable>
 */
function ReplicatedSet() {
  // Map of a comparable form (that compares correctly using ===) of the elements to the elements
  let currentValue = new Map();
  let delta = {
    added: new Map(),
    removed: new Map(),
    cleared: false,
  };

  /**
   * Does this set contain the given element?
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#has
   * @param {module:akkaserverless.Serializable} element The element to check.
   * @returns {boolean} True if the set contains the element.
   */
  this.has = function (element) {
    return currentValue.has(AnySupport.toComparable(element));
  };

  /**
   * The number of elements in this set.
   *
   * @name module:akkaserverless.replicatedentity.ReplicatedSet#size
   * @type {number}
   * @readonly
   */
  Object.defineProperty(this, 'size', {
    get: function () {
      return currentValue.size;
    },
  });

  /**
   * Execute the given callback for each element.
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#forEach
   * @param {module:akkaserverless.replicatedentity.ReplicatedSet~forEachCallback} callback The callback to handle each element.
   */
  this.forEach = function (callback) {
    return currentValue.forEach((value, key) => callback(value));
  };

  /**
   * Create an iterator for this set.
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#iterator
   * @returns {Iterator<module:akkaserverless.Serializable>}
   */
  this[Symbol.iterator] = function () {
    return currentValue.values();
  };

  /**
   * Get a copy of the current elements as a Set.
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#elements
   * @return {Set<module:akkaserverless.Serializable>}
   */
  this.elements = function () {
    return new Set(currentValue.values());
  };

  /**
   * Add an element to this set.
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#add
   * @param {module:akkaserverless.Serializable} element The element to add.
   * @return {module:akkaserverless.replicatedentity.ReplicatedSet} This set.
   */
  this.add = function (element) {
    const comparable = AnySupport.toComparable(element);
    if (!currentValue.has(comparable)) {
      if (delta.removed.has(comparable)) {
        delta.removed.delete(comparable);
      } else {
        const serializedElement = AnySupport.serialize(element, true, true);
        delta.added.set(comparable, serializedElement);
      }
      currentValue.set(comparable, element);
    }
    return this;
  };

  /**
   * Add multiple elements to this set.
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#addAll
   * @param {Iterator<module:akkaserverless.Serializable>} elements The elements to add.
   * @return {module:akkaserverless.replicatedentity.ReplicatedSet} This set.
   */
  this.addAll = function (elements) {
    for (const element of elements) {
      this.add(element);
    }
    return this;
  };

  /**
   * Remove an element from this set.
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#delete
   * @param {module:akkaserverless.Serializable} element The element to delete.
   * @return {module:akkaserverless.replicatedentity.ReplicatedSet} This set.
   */
  this.delete = function (element) {
    const comparable = AnySupport.toComparable(element);
    if (currentValue.has(comparable)) {
      if (currentValue.size === 1) {
        this.clear();
      } else {
        currentValue.delete(comparable);
        if (delta.added.has(comparable)) {
          delta.added.delete(comparable);
        } else {
          const serializedElement = AnySupport.serialize(element, true, true);
          delta.removed.set(comparable, serializedElement);
        }
      }
    }
    return this;
  };

  /**
   * Remove all elements from this set.
   *
   * @function module:akkaserverless.replicatedentity.ReplicatedSet#clear
   * @return {module:akkaserverless.replicatedentity.ReplicatedSet} This set.
   */
  this.clear = function () {
    if (currentValue.size > 0) {
      delta.cleared = true;
      delta.added.clear();
      delta.removed.clear();
      currentValue.clear();
    }
    return this;
  };

  this.getAndResetDelta = function (initial) {
    if (
      delta.cleared ||
      delta.added.size > 0 ||
      delta.removed.size > 0 ||
      initial
    ) {
      const currentDelta = {
        replicatedSet: {
          cleared: delta.cleared,
          removed: Array.from(delta.removed.values()),
          added: Array.from(delta.added.values()),
        },
      };
      delta.cleared = false;
      delta.added.clear();
      delta.removed.clear();
      return currentDelta;
    } else {
      return null;
    }
  };

  this.applyDelta = function (delta, anySupport) {
    if (!delta.replicatedSet) {
      throw new Error(
        util.format('Cannot apply delta %o to ReplicatedSet', delta),
      );
    }
    if (delta.replicatedSet.cleared) {
      currentValue.clear();
    }
    if (delta.replicatedSet.removed !== undefined) {
      delta.replicatedSet.removed.forEach((element) => {
        const value = anySupport.deserialize(element);
        const comparable = AnySupport.toComparable(value);
        if (currentValue.has(comparable)) {
          currentValue.delete(comparable);
        } else {
          debug(
            "Delta instructed to delete element [%o], but it wasn't in the ReplicatedSet.",
            comparable,
          );
        }
      });
    }
    if (delta.replicatedSet.added !== undefined) {
      delta.replicatedSet.added.forEach((element) => {
        const value = anySupport.deserialize(element);
        const comparable = AnySupport.toComparable(value);
        if (currentValue.has(comparable)) {
          debug(
            "Delta instructed to add value [%o], but it's already present in the ReplicatedSet",
            comparable,
          );
        } else {
          currentValue.set(comparable, value);
        }
      });
    }
  };

  this.toString = function () {
    return 'ReplicatedSet(' + Array.from(currentValue).join(',') + ')';
  };
}

module.exports = ReplicatedSet;
